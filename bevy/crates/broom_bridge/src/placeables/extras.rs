//! Placeable components in shipped levels: the editor's GLB export writes each object's
//! components into its node extras under `broom_components`, and [`BroomGltfComponentsPlugin`]
//! composes and inserts them when the glTF scene spawns. A game can add the plugin on its own,
//! without the bridge or a manifest.

use bevy::app::{SceneSpawnerSystems, SpawnScene};
use bevy::gltf::GltfExtras;
use bevy::prelude::*;
use serde::de::DeserializeOwned;

use super::assets::PlaceableAssetTypes;
use super::compose::ComposeContext;
use super::placeable_basics_init;
use super::registry::PlaceableClasses;
use super::sync::{component_insert, errors_report};
use crate::protocol::{AuthoredComponents, EXTRAS_COMPONENTS, validate_components};

/// Inserts the placeable components stored in glTF node extras when a scene spawns.
pub struct BroomGltfComponentsPlugin;

impl Plugin for BroomGltfComponentsPlugin {
    fn build(&self, app: &mut App) {
        placeable_basics_init(app);
        app.add_systems(
            SpawnScene,
            insert_extras_components
                .after(SceneSpawnerSystems::WorldInstanceSpawn)
                .after(SceneSpawnerSystems::SceneSpawn),
        );
    }
}

/// One spawned node whose extras carry components.
struct ExtrasNode {
    entity: Entity,
    label: String,
    components: AuthoredComponents,
}

/// The value stored under `key` in a node's extras JSON, read as `T`, or `None` when the JSON
/// is malformed, has no such key or the value does not have the shape of `T`.
pub(crate) fn extras_entry<T: DeserializeOwned>(json: &str, key: &str) -> Option<T> {
    let mut value: serde_json::Value = serde_json::from_str(json).ok()?;
    let entry = value.get_mut(key)?.take();
    serde_json::from_value::<T>(entry).ok()
}

/// The components in a node's extras JSON, or `None` when it has none or they are malformed.
pub(crate) fn components_from_extras(json: &str) -> Option<AuthoredComponents> {
    extras_entry::<AuthoredComponents>(json, EXTRAS_COMPONENTS)
        .filter(|components| validate_components(components).is_ok())
}

/// Composes and inserts the components of every node that just spawned with extras.
fn insert_extras_components(
    world: &mut World,
    nodes: &mut QueryState<(Entity, &GltfExtras, Option<&Name>), Added<GltfExtras>>,
) {
    let found: Vec<ExtrasNode> = nodes
        .iter(world)
        .filter_map(|(entity, extras, name)| {
            Some(ExtrasNode {
                entity,
                label: name.map_or_else(|| format!("{entity}"), |name| name.to_string()),
                components: components_from_extras(&extras.value)?,
            })
        })
        .collect();
    if found.is_empty() {
        return;
    }
    let errors = nodes_insert(world, found);
    errors_report(world, errors);
}

/// Inserts the components of `found` and returns every error, prefixed with the node.
fn nodes_insert(world: &mut World, found: Vec<ExtrasNode>) -> Vec<String> {
    let registry = world.resource::<AppTypeRegistry>().clone();
    let registry = registry.read();
    let classes = world.resource::<PlaceableClasses>().clone();
    let assets = world.resource::<PlaceableAssetTypes>().clone();
    let asset_server = world.get_resource::<AssetServer>().cloned();
    let context = ComposeContext {
        registry: &registry,
        assets: &assets,
        asset_server: asset_server.as_ref(),
    };
    let mut errors = Vec::new();
    for node in found {
        let Ok(mut target) = world.get_entity_mut(node.entity) else {
            continue;
        };
        for (type_path, fields) in &node.components {
            match component_insert(&mut target, &context, &classes, type_path, fields) {
                Ok(field_errors) => errors.extend(
                    field_errors
                        .into_iter()
                        .map(|error| format!("node {}: {error}", node.label)),
                ),
                Err(error) => errors.push(format!("node {}: {error}", node.label)),
            }
        }
    }
    errors
}
