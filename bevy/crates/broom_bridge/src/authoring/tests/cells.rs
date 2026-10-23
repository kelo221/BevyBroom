//! Rooms and portals follow the applied snapshot: spawned with their full world transforms,
//! closed and opened in place, respawned when their kind changes and despawned when deleted or
//! hidden.

use std::collections::HashMap;

use bevy::prelude::*;
use dynlight::portals::{ClosedPortal, Portal, Room};

use super::*;
use crate::authoring::AuthoredCellEntity;
use crate::protocol::{AuthoredObject, AuthoredPortal, AuthoredRoom};
use crate::test_support::{next_revision, object_mut};

/// One spawned room or portal as the tests see it.
#[derive(Clone, Debug)]
struct SpawnedCell {
    entity: Entity,
    room: Option<Room>,
    portal: Option<Portal>,
    closed: bool,
    transform: Transform,
}

/// Every authored room and portal entity in `app` by id. Fails the test when an id is spawned
/// twice.
fn spawned_cells(app: &mut App) -> HashMap<String, SpawnedCell> {
    let mut query = app.world_mut().query::<(
        Entity,
        &AuthoredCellEntity,
        Option<&Room>,
        Option<&Portal>,
        Has<ClosedPortal>,
        &Transform,
    )>();
    let mut cells = HashMap::new();
    for (entity, owner, room, portal, closed, transform) in query.iter(app.world()) {
        let spawned = SpawnedCell {
            entity,
            room: room.copied(),
            portal: portal.cloned(),
            closed,
            transform: *transform,
        };
        let previous = cells.insert(owner.id.clone(), spawned);
        assert!(previous.is_none(), "cell {} is spawned twice", owner.id);
    }
    cells
}

/// The id of the first object of `kind` in `state`.
fn first_id_of_kind(state: &AuthoredState, kind: AuthoredObjectKind) -> String {
    state
        .objects
        .iter()
        .find(|object| object.kind == kind)
        .map(|object| object.id.clone())
        .expect("the sample has an object of this kind")
}

/// The portal settings of object `id` in `state`, to edit.
fn portal_mut<'a>(state: &'a mut AuthoredState, id: &str) -> &'a mut AuthoredPortal {
    object_mut(state, id)
        .portal
        .as_mut()
        .expect("the object is a portal")
}

/// Every room and portal of the sample is spawned once with its DynLight component and the
/// world transform of its hierarchy, scale included.
#[test]
fn spawns_rooms_and_portals_with_scaled_world_transforms() {
    let (mut app, state) = app_with_sample();
    let cells = spawned_cells(&mut app);
    let expected: Vec<&AuthoredObject> = state
        .objects
        .iter()
        .filter(|object| object.room.is_some() || object.portal.is_some())
        .collect();
    assert!(expected.iter().any(|object| object.room.is_some()));
    assert!(expected.iter().any(|object| object.portal.is_some()));
    assert_eq!(cells.len(), expected.len());
    for object in expected {
        let cell = &cells[&object.id];
        assert_eq!(cell.room, object.room.as_ref().map(AuthoredRoom::to_room));
        assert_eq!(
            cell.portal,
            object.portal.as_ref().map(AuthoredPortal::to_portal)
        );
        let closed = object.portal.as_ref().is_some_and(|portal| portal.closed);
        assert_eq!(cell.closed, closed);
        let world = expected_scaled_world_transform(&state, &object.id);
        assert_transform_close(&cell.transform, &world);
    }
}

/// Closing a portal adds `ClosedPortal` to the same entity and opening it removes it again.
#[test]
fn closing_and_opening_a_portal_toggles_closed_portal_in_place() {
    let (mut app, state) = app_with_sample();
    let id = first_id_of_kind(&state, AuthoredObjectKind::Portal);
    let entity = spawned_cells(&mut app)[&id].entity;
    let mut closed = next_revision(&state);
    let was_closed = portal_mut(&mut closed, &id).closed;
    portal_mut(&mut closed, &id).closed = !was_closed;
    state_send(&mut app, closed.clone()).expect("the edit is valid");
    let cell = spawned_cells(&mut app)[&id].clone();
    assert_eq!((cell.entity, cell.closed), (entity, !was_closed));
    let mut reopened = next_revision(&closed);
    portal_mut(&mut reopened, &id).closed = was_closed;
    state_send(&mut app, reopened).expect("the edit is valid");
    let cell = spawned_cells(&mut app)[&id].clone();
    assert_eq!((cell.entity, cell.closed), (entity, was_closed));
}

/// Resizing a room updates it in place; turning it into a portal respawns it as a portal.
#[test]
fn resized_rooms_update_in_place_and_kind_changes_respawn() {
    let (mut app, state) = app_with_sample();
    let id = first_id_of_kind(&state, AuthoredObjectKind::Room);
    let entity = spawned_cells(&mut app)[&id].entity;
    let mut resized = next_revision(&state);
    let room = object_mut(&mut resized, &id).room.as_mut().expect("room");
    room.half_size[0] += 1.0;
    let expected_room = room.to_room();
    state_send(&mut app, resized.clone()).expect("the edit is valid");
    let cell = spawned_cells(&mut app)[&id].clone();
    assert_eq!((cell.entity, cell.room), (entity, Some(expected_room)));
    let mut changed = next_revision(&resized);
    let object = object_mut(&mut changed, &id);
    object.kind = AuthoredObjectKind::Portal;
    object.room = None;
    object.portal = Some(AuthoredPortal {
        size: [1.0, 2.0],
        closed: true,
    });
    state_send(&mut app, changed).expect("the edit is valid");
    let cell = spawned_cells(&mut app)[&id].clone();
    assert_ne!(cell.entity, entity);
    assert!(cell.room.is_none() && cell.portal.is_some() && cell.closed);
    assert!(app.world().get_entity(entity).is_err());
}

/// Deleting a portal despawns it, and hiding a room's parent despawns the room.
#[test]
fn deleted_and_hidden_cells_are_despawned() {
    let (mut app, state) = app_with_sample();
    let portal_id = first_id_of_kind(&state, AuthoredObjectKind::Portal);
    let (room_id, parent_id) = room_inside_a_group(&state);
    let mut edited = next_revision(&state);
    edited.objects.retain(|object| object.id != portal_id);
    object_mut(&mut edited, &parent_id).visible = false;
    state_send(&mut app, edited).expect("the edit is valid");
    let cells = spawned_cells(&mut app);
    assert!(!cells.contains_key(&portal_id));
    assert!(!cells.contains_key(&room_id));
}

/// The id of a room in `state` that has a parent, and that parent's id.
fn room_inside_a_group(state: &AuthoredState) -> (String, String) {
    let rooms = state.objects.iter().filter(|object| object.room.is_some());
    let mut pairs = rooms.filter_map(|object| {
        let parent = object.parent_id.clone();
        parent.map(|parent| (object.id.clone(), parent))
    });
    pairs.next().expect("the sample has a room inside a group")
}
