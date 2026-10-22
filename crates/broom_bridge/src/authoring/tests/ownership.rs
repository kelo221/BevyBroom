//! The authored-versus-game-owned contract: a snapshot that leaves an object unchanged keeps
//! what gameplay did to it, and an edit of that object writes its authored values again.

use bevy::prelude::*;
use dynlight::portals::ClosedPortal;

use super::*;
use crate::authoring::AuthoredCellEntity;
use crate::protocol::AuthoredObject;
use crate::test_support::{next_revision, object_mut};

/// The id of the sample's door portal.
const DOOR_ID: &str = "portal-door";

/// The id of the sample's lamp.
const LAMP_ID: &str = "light-lamp";

/// The id of a sample object that is neither the door nor the lamp.
const UNRELATED_ID: &str = "game-spawn";

/// The sample with its door authored closed, applied to a fresh app.
fn app_with_closed_door() -> (App, AuthoredState) {
    let mut app = authoring_app();
    let mut state = sample_state();
    door_mut(&mut state).closed = true;
    state_send(&mut app, state.clone()).expect("the sample applies");
    (app, state)
}

/// The door's portal settings in `state`.
fn door_mut(state: &mut AuthoredState) -> &mut crate::protocol::AuthoredPortal {
    object_mut(state, DOOR_ID)
        .portal
        .as_mut()
        .expect("the door is a portal")
}

/// The entity of the authored cell `id`.
fn cell_entity(app: &mut App, id: &str) -> Entity {
    let mut query = app.world_mut().query::<(Entity, &AuthoredCellEntity)>();
    query
        .iter(app.world())
        .find(|(_, owner)| owner.id == id)
        .map(|(entity, _)| entity)
        .unwrap_or_else(|| panic!("cell {id} is spawned"))
}

/// Whether the door entity is closed right now.
fn door_is_closed(app: &mut App) -> bool {
    let door = cell_entity(app, DOOR_ID);
    app.world().entity(door).contains::<ClosedPortal>()
}

/// The next snapshot of `state` with the unrelated object moved along X.
fn unrelated_object_moved(state: &AuthoredState) -> AuthoredState {
    let mut next = next_revision(state);
    let unrelated: &mut AuthoredObject = object_mut(&mut next, UNRELATED_ID);
    unrelated.translation[0] += 1.5;
    next
}

#[test]
fn a_door_opened_by_gameplay_stays_open_while_another_object_is_edited() {
    let (mut app, state) = app_with_closed_door();
    assert!(door_is_closed(&mut app));
    let door = cell_entity(&mut app, DOOR_ID);
    app.world_mut().entity_mut(door).remove::<ClosedPortal>();
    let moved = unrelated_object_moved(&state);
    state_send(&mut app, moved.clone()).expect("the edit applies");
    assert!(
        !door_is_closed(&mut app),
        "the unrelated edit closed the door"
    );
    let mut door_edited = next_revision(&moved);
    door_mut(&mut door_edited).size[0] += 0.25;
    state_send(&mut app, door_edited).expect("the door edit applies");
    assert!(
        door_is_closed(&mut app),
        "an edit of the door writes its authored state"
    );
}

#[test]
fn a_light_moved_by_gameplay_keeps_its_place_until_the_light_is_edited() {
    let mut app = authoring_app();
    let state = sample_state();
    state_send(&mut app, state.clone()).expect("the sample applies");
    let authored = spawned_lights(&mut app)[LAMP_ID].transform;
    let lamp = spawned_lights(&mut app)[LAMP_ID].entity;
    let gameplay_position = authored.translation + Vec3::new(0.0, 2.0, 0.0);
    app.world_mut()
        .entity_mut(lamp)
        .get_mut::<Transform>()
        .expect("the lamp has a transform")
        .translation = gameplay_position;
    let moved = unrelated_object_moved(&state);
    state_send(&mut app, moved.clone()).expect("the edit applies");
    let kept = spawned_lights(&mut app)[LAMP_ID].transform.translation;
    assert!(kept.distance(gameplay_position) < TOLERANCE);
    let mut lamp_edited = next_revision(&moved);
    object_mut(&mut lamp_edited, LAMP_ID).translation[2] += 0.5;
    state_send(&mut app, lamp_edited).expect("the lamp edit applies");
    let rewritten = spawned_lights(&mut app)[LAMP_ID].transform.translation;
    assert!(rewritten.distance(gameplay_position) > 0.1);
}

#[test]
fn another_document_writes_every_authored_value_again() {
    let (mut app, state) = app_with_closed_door();
    let door = cell_entity(&mut app, DOOR_ID);
    app.world_mut().entity_mut(door).remove::<ClosedPortal>();
    let other_document = AuthoredState {
        document_id: format!("{}-other", state.document_id),
        revision: 1,
        ..state
    };
    state_send(&mut app, other_document).expect("the other document applies");
    assert!(door_is_closed(&mut app));
}
