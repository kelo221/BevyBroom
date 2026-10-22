//! DynLight room cells and portals spawned from the applied snapshot, one entity per authored
//! room or portal id.
//!
//! Like lights they live at the top level with world transforms computed from the authored
//! hierarchy. Unlike lights they keep the full scale, because DynLight sizes cells and openings
//! with it. Shear from a rotated parent under non-uniform scale is not represented.

use std::collections::HashMap;

use bevy::prelude::*;
use dynlight::portals::{ClosedPortal, Portal, Room};

use super::AppliedAuthoring;
use super::ownership::{authored_unchanged, previous_of_same_document};
use crate::protocol::{AuthoredHierarchy, AuthoredObject, AuthoredObjectKind, AuthoredState};

/// A room or portal owned by an editor document.
#[derive(Component, Clone, Debug, PartialEq, Eq)]
pub struct AuthoredCellEntity {
    pub id: String,
    pub document_id: String,
}

/// The DynLight component one authored object asks for.
#[derive(Clone, Debug, PartialEq)]
pub(crate) enum CellShape {
    Room(Room),
    Portal { portal: Portal, closed: bool },
}

/// What one authored room or portal should look like in the world.
#[derive(Clone, Debug, PartialEq)]
pub(crate) struct CellTarget {
    pub shape: CellShape,
    pub transform: Transform,
    pub name: String,
}

/// The shape `object` asks for, if it is a room or portal with settings.
fn cell_shape(object: &AuthoredObject) -> Option<CellShape> {
    match object.kind {
        AuthoredObjectKind::Room => object
            .room
            .as_ref()
            .map(|room| CellShape::Room(room.to_room())),
        AuthoredObjectKind::Portal => object.portal.as_ref().map(|portal| CellShape::Portal {
            portal: portal.to_portal(),
            closed: portal.closed,
        }),
        _ => None,
    }
}

/// The rooms and portals `state` asks for, by id: those whose whole ancestry is visible.
pub(crate) fn cell_targets(state: &AuthoredState) -> HashMap<String, CellTarget> {
    let hierarchy = AuthoredHierarchy::new(state);
    state
        .objects
        .iter()
        .filter_map(|object| {
            let shape = cell_shape(object)?;
            if !hierarchy.effectively_visible(&object.id) {
                return None;
            }
            let target = CellTarget {
                shape,
                transform: hierarchy.world_transform(&object.id)?,
                name: cell_name(object),
            };
            Some((object.id.clone(), target))
        })
        .collect()
}

/// The entity name DynLight's warnings show: the editor name, or the id when it has none.
fn cell_name(object: &AuthoredObject) -> String {
    if object.name.is_empty() {
        format!("BevyBroom {}", object.id)
    } else {
        object.name.clone()
    }
}

/// The room and portal components of one existing cell entity.
type CellComponents<'a> = (
    Entity,
    &'a AuthoredCellEntity,
    Option<&'a mut Room>,
    Option<&'a mut Portal>,
    Has<ClosedPortal>,
    &'a mut Transform,
    &'a mut Name,
);

/// Spawns, updates and despawns room and portal entities to match the applied snapshot. A cell
/// is only written when its authored target changed since the previous snapshot, so a door
/// gameplay opened stays open while unrelated objects are edited. Components are only written
/// when they differ so DynLight rebuilds its graph only on real changes; a cell that changes
/// between room and portal is respawned.
pub(super) fn sync_cells(
    mut commands: Commands,
    applied: Res<AppliedAuthoring>,
    mut cells: Query<CellComponents>,
) {
    if !applied.is_changed() {
        return;
    }
    let Some(state) = applied.state.as_ref() else {
        return;
    };
    let mut targets = cell_targets(state);
    let previous_targets = previous_of_same_document(&applied).map(cell_targets);
    for (entity, owner, room, portal, closed, mut transform, mut name) in &mut cells {
        let target = (owner.document_id == state.document_id)
            .then(|| targets.remove(&owner.id))
            .flatten();
        let Some(target) = target else {
            commands.entity(entity).despawn();
            continue;
        };
        if authored_unchanged(previous_targets.as_ref(), &owner.id, &target) {
            continue;
        }
        if !cell_update(&mut commands, entity, room, portal, closed, &target.shape) {
            commands.entity(entity).despawn();
            targets.insert(owner.id.clone(), target);
            continue;
        }
        transform.set_if_neq(target.transform);
        if name.as_str() != target.name {
            *name = Name::new(target.name);
        }
    }
    for (id, target) in targets {
        cell_spawn(&mut commands, id, &state.document_id, target);
    }
}

/// Brings an existing cell's components to `shape`. Returns false when the entity holds the
/// other kind of cell and must be respawned.
fn cell_update(
    commands: &mut Commands,
    entity: Entity,
    room: Option<Mut<Room>>,
    portal: Option<Mut<Portal>>,
    closed: bool,
    shape: &CellShape,
) -> bool {
    match (shape, room, portal) {
        (CellShape::Room(target), Some(mut room), None) => {
            room.set_if_neq(*target);
            true
        }
        (
            CellShape::Portal {
                portal: target,
                closed: target_closed,
            },
            None,
            Some(mut portal),
        ) => {
            portal.set_if_neq(target.clone());
            if *target_closed && !closed {
                commands.entity(entity).insert(ClosedPortal);
            } else if !*target_closed && closed {
                commands.entity(entity).remove::<ClosedPortal>();
            }
            true
        }
        _ => false,
    }
}

/// Spawns one room or portal entity.
fn cell_spawn(commands: &mut Commands, id: String, document_id: &str, target: CellTarget) {
    let owner = AuthoredCellEntity {
        id,
        document_id: document_id.to_owned(),
    };
    let mut entity = commands.spawn((Name::new(target.name), owner, target.transform));
    match target.shape {
        CellShape::Room(room) => {
            entity.insert(room);
        }
        CellShape::Portal { portal, closed } => {
            entity.insert(portal);
            if closed {
                entity.insert(ClosedPortal);
            }
        }
    }
}
