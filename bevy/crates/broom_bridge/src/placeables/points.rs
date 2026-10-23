//! Game entities: empty points spawned from the applied snapshot, one entity per authored
//! `game_entity` id. Their placeable components are attached like on any other object.
//!
//! Like lights they live at the top level with world transforms computed from the authored
//! hierarchy, so replacing the geometry never despawns them.

use std::collections::HashMap;

use bevy::prelude::*;

use crate::authoring::AppliedAuthoring;
use crate::protocol::{AuthoredHierarchy, AuthoredObjectKind, AuthoredState};

/// A game entity owned by an editor document.
#[derive(Component, Reflect, Clone, Debug, PartialEq, Eq)]
#[reflect(Component)]
pub struct AuthoredGameEntity {
    pub id: String,
    pub document_id: String,
}

/// What one authored game entity should look like in the world.
#[derive(Clone, Debug, PartialEq)]
pub(crate) struct PointTarget {
    pub transform: Transform,
    pub name: String,
}

/// The game entities `state` asks for, by id: those whose whole ancestry is visible.
pub(crate) fn point_targets(state: &AuthoredState) -> HashMap<String, PointTarget> {
    let hierarchy = AuthoredHierarchy::new(state);
    state
        .objects
        .iter()
        .filter(|object| object.kind == AuthoredObjectKind::GameEntity)
        .filter(|object| hierarchy.effectively_visible(&object.id))
        .filter_map(|object| {
            let transform = hierarchy.world_transform(&object.id)?;
            let name = if object.name.is_empty() {
                format!("BevyBroom game entity {}", object.id)
            } else {
                object.name.clone()
            };
            Some((object.id.clone(), PointTarget { transform, name }))
        })
        .collect()
}

/// Spawns, updates and despawns game entities to match the applied snapshot.
pub(super) fn sync_game_entities(
    mut commands: Commands,
    applied: Res<AppliedAuthoring>,
    mut points: Query<(Entity, &AuthoredGameEntity, &mut Transform, &mut Name)>,
) {
    if !applied.is_changed() {
        return;
    }
    let Some(state) = applied.state.as_ref() else {
        return;
    };
    let mut targets = point_targets(state);
    for (entity, owner, mut transform, mut name) in &mut points {
        let target = (owner.document_id == state.document_id)
            .then(|| targets.remove(&owner.id))
            .flatten();
        let Some(target) = target else {
            commands.entity(entity).despawn();
            continue;
        };
        transform.set_if_neq(target.transform);
        if name.as_str() != target.name {
            name.set(target.name);
        }
    }
    for (id, target) in targets {
        commands.spawn((
            Name::new(target.name),
            AuthoredGameEntity {
                id,
                document_id: state.document_id.clone(),
            },
            target.transform,
            Visibility::default(),
        ));
    }
}
