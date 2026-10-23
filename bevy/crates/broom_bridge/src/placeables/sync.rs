//! Attaching the applied snapshot's placeable components to the entities that show each
//! authored object.
//!
//! Every target remembers a hash of the overrides it was given per component, so only changed
//! components are composed again. A component that cannot be placed is reported once per
//! change and the value placed before stays.

use std::collections::{BTreeMap, HashMap};
use std::hash::{DefaultHasher, Hash, Hasher};

use bevy::prelude::*;
use serde_json::Value;

use super::assets::PlaceableAssetTypes;
use super::compose::{ComposeContext, compose};
use super::registry::PlaceableClasses;
use super::targets::AuthoredTarget;
use crate::authoring::AppliedAuthoring;
use crate::protocol::AuthoredComponents;
use crate::status::BridgeStatus;

/// One component placed on an entity.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct PlacedEntry {
    /// The hash of the overrides it was last given.
    hash: u64,
    /// Whether the component is on the entity.
    inserted: bool,
}

/// The placeable components on an entity that shows an authored object, by type path.
#[derive(Component, Clone, Debug, Default, PartialEq)]
pub struct PlacedComponents {
    applied: HashMap<String, PlacedEntry>,
}

impl PlacedComponents {
    /// How many components are on the entity.
    pub fn count(&self) -> usize {
        self.applied.values().filter(|entry| entry.inserted).count()
    }

    /// Whether the component at `type_path` is on the entity.
    pub fn contains(&self, type_path: &str) -> bool {
        self.applied
            .get(type_path)
            .is_some_and(|entry| entry.inserted)
    }
}

/// One entity to bring up to date.
struct TargetWork {
    entity: Entity,
    id: String,
    desired: AuthoredComponents,
    placed: PlacedComponents,
}

/// The applied document and revision the components were last synced with.
type SyncedRevision = Option<(String, u64)>;

/// Inserts, updates and removes placeable components: on every target when the snapshot
/// changed, otherwise only on targets that just appeared.
pub(super) fn sync_placed_components(
    world: &mut World,
    targets: &mut QueryState<AuthoredTarget>,
    mut synced: Local<SyncedRevision>,
) {
    let Some(work) = targets_collect(world, targets, &mut synced) else {
        return;
    };
    let registry = world.resource::<AppTypeRegistry>().clone();
    let registry = registry.read();
    let classes = world
        .get_resource::<PlaceableClasses>()
        .cloned()
        .unwrap_or_default();
    let assets = world
        .get_resource::<PlaceableAssetTypes>()
        .cloned()
        .unwrap_or_default();
    let asset_server = world.get_resource::<AssetServer>().cloned();
    let context = ComposeContext {
        registry: &registry,
        assets: &assets,
        asset_server: asset_server.as_ref(),
    };
    let mut errors = Vec::new();
    for item in work {
        target_sync(world, &context, &classes, item, &mut errors);
    }
    errors_report(world, errors);
}

/// The targets to sync this frame, or `None` when there is nothing to do.
fn targets_collect(
    world: &World,
    targets: &mut QueryState<AuthoredTarget>,
    synced: &mut SyncedRevision,
) -> Option<Vec<TargetWork>> {
    let state = world.get_resource::<AppliedAuthoring>()?.state.as_ref()?;
    let revision = Some((state.document_id.clone(), state.revision));
    let everything = *synced != revision;
    *synced = revision;
    let by_id: HashMap<&str, &AuthoredComponents> = state
        .objects
        .iter()
        .map(|object| (object.id.as_str(), &object.components))
        .collect();
    let work: Vec<TargetWork> = targets
        .iter(world)
        .filter(|target| everything || target.placed.is_none())
        .map(|target| {
            let id = target.authored_id();
            TargetWork {
                entity: target.entity,
                id: id.to_owned(),
                desired: by_id
                    .get(id)
                    .map(|components| (*components).clone())
                    .unwrap_or_default(),
                placed: target.placed.cloned().unwrap_or_default(),
            }
        })
        .collect();
    (!work.is_empty()).then_some(work)
}

/// Brings the components of one target up to date and records what was placed.
fn target_sync(
    world: &mut World,
    context: &ComposeContext,
    classes: &PlaceableClasses,
    work: TargetWork,
    errors: &mut Vec<String>,
) {
    let TargetWork {
        entity,
        id,
        desired,
        mut placed,
    } = work;
    let Ok(mut target) = world.get_entity_mut(entity) else {
        return;
    };
    for (type_path, fields) in &desired {
        let hash = fields_hash(fields);
        let previous = placed.applied.get(type_path).copied();
        if previous.is_some_and(|entry| entry.hash == hash) {
            continue;
        }
        let inserted = match component_insert(&mut target, context, classes, type_path, fields) {
            Ok(field_errors) => {
                errors.extend(
                    field_errors
                        .into_iter()
                        .map(|error| format!("object {id}: {error}")),
                );
                true
            }
            Err(error) => {
                errors.push(format!("object {id}: {error}"));
                previous.is_some_and(|entry| entry.inserted)
            }
        };
        placed
            .applied
            .insert(type_path.clone(), PlacedEntry { hash, inserted });
    }
    stale_components_remove(&mut target, context, &desired, &mut placed);
    target.insert(placed);
}

/// Composes the component at `type_path` and inserts it, replacing the one placed before.
/// Returns the overrides that could not be applied.
pub(super) fn component_insert(
    target: &mut EntityWorldMut,
    context: &ComposeContext,
    classes: &PlaceableClasses,
    type_path: &str,
    fields: &BTreeMap<String, Value>,
) -> Result<Vec<String>, String> {
    if !classes.contains(type_path) {
        return Err(format!(
            "{type_path} is not a placeable component of this game"
        ));
    }
    let reflect_component = context
        .registry
        .get_with_type_path(type_path)
        .and_then(|registration| registration.data::<ReflectComponent>())
        .ok_or_else(|| format!("{type_path} does not reflect Component"))?;
    let composed = compose(context, type_path, fields)?;
    reflect_component.insert(
        target,
        composed.value.as_partial_reflect(),
        context.registry,
    );
    Ok(composed.errors)
}

/// Removes the components placed before that the snapshot no longer asks for.
fn stale_components_remove(
    target: &mut EntityWorldMut,
    context: &ComposeContext,
    desired: &AuthoredComponents,
    placed: &mut PlacedComponents,
) {
    let stale: Vec<String> = placed
        .applied
        .keys()
        .filter(|type_path| !desired.contains_key(*type_path))
        .cloned()
        .collect();
    for type_path in stale {
        let was_inserted = placed
            .applied
            .remove(&type_path)
            .is_some_and(|entry| entry.inserted);
        let reflect_component = context
            .registry
            .get_with_type_path(&type_path)
            .and_then(|registration| registration.data::<ReflectComponent>());
        if was_inserted && let Some(reflect_component) = reflect_component {
            reflect_component.remove(target);
        }
    }
}

/// A hash of one component's overrides.
fn fields_hash(fields: &BTreeMap<String, Value>) -> u64 {
    let mut hasher = DefaultHasher::new();
    serde_json::to_string(fields)
        .unwrap_or_default()
        .hash(&mut hasher);
    hasher.finish()
}

/// Reports every error to the status, or to the log when there is no status.
pub(super) fn errors_report(world: &mut World, errors: Vec<String>) {
    let Some(mut status) = world.get_resource_mut::<BridgeStatus>() else {
        for error in errors {
            warn!("broom bridge: {error}");
        }
        return;
    };
    for error in errors {
        status.report_error(error);
    }
}

/// Counts the placeable classes and the placed components for the status.
pub(super) fn refresh_placeable_status(
    mut status: ResMut<BridgeStatus>,
    classes: Option<Res<PlaceableClasses>>,
    placed: Query<&PlacedComponents>,
) {
    let status = status.bypass_change_detection();
    status.placeable_class_count = classes.map_or(0, |classes| classes.len());
    status.placed_component_count = placed.iter().map(PlacedComponents::count).sum();
}
