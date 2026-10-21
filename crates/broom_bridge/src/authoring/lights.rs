//! DynLight lights spawned from the applied snapshot, one entity per authored light id.
//!
//! Lights live at the top level with world transforms computed from the authored hierarchy, so
//! replacing the geometry never despawns them and a parent group's move still carries them.

use std::collections::HashMap;

use bevy::prelude::*;
use dynlight::light::DynamicLight;

use super::AppliedAuthoring;
use crate::protocol::{AuthoredHierarchy, AuthoredObjectKind, AuthoredState};

/// A light owned by an editor document.
#[derive(Component, Clone, Debug, PartialEq, Eq)]
pub struct AuthoredLightEntity {
    pub id: String,
    pub document_id: String,
}

/// What one authored light should look like in the world.
#[derive(Clone, Debug, PartialEq)]
pub(crate) struct LightTarget {
    pub light: DynamicLight,
    pub transform: Transform,
}

/// The lights `state` asks for, by id: enabled lights whose whole ancestry is visible.
pub(crate) fn light_targets(state: &AuthoredState) -> HashMap<String, LightTarget> {
    let hierarchy = AuthoredHierarchy::new(state);
    state
        .objects
        .iter()
        .filter(|object| object.kind == AuthoredObjectKind::Light)
        .filter_map(|object| {
            let light = object.light.as_ref().filter(|light| light.enabled)?;
            if !hierarchy.effectively_visible(&object.id) {
                return None;
            }
            let transform = hierarchy.world_transform(&object.id)?;
            let target = LightTarget {
                light: light.to_dynamic_light(),
                transform: Transform {
                    scale: Vec3::ONE,
                    ..transform
                },
            };
            Some((object.id.clone(), target))
        })
        .collect()
}

/// Spawns, updates and despawns light entities to match the applied snapshot. Components are
/// only written when they differ so DynLight's change detection sees real changes only.
pub(super) fn sync_lights(
    mut commands: Commands,
    applied: Res<AppliedAuthoring>,
    mut lights: Query<(
        Entity,
        &AuthoredLightEntity,
        &mut DynamicLight,
        &mut Transform,
    )>,
) {
    if !applied.is_changed() {
        return;
    }
    let Some(state) = applied.state.as_ref() else {
        return;
    };
    let mut targets = light_targets(state);
    for (entity, owner, mut light, mut transform) in &mut lights {
        let target = (owner.document_id == state.document_id)
            .then(|| targets.remove(&owner.id))
            .flatten();
        let Some(target) = target else {
            commands.entity(entity).despawn();
            continue;
        };
        light.set_if_neq(target.light);
        transform.set_if_neq(target.transform);
    }
    for (id, target) in targets {
        commands.spawn((
            Name::new(format!("BevyBroom light {id}")),
            AuthoredLightEntity {
                id,
                document_id: state.document_id.clone(),
            },
            target.light,
            target.transform,
        ));
    }
}
