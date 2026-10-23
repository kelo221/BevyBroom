//! Which snapshots reach the lights: resends, editor restarts, stale and invalid snapshots, and
//! document switches.

use bevy::ecs::message::Messages;
use bevy::prelude::*;

use super::*;
use crate::authoring::{AppliedAuthoring, AuthoringInbox, DocumentSwitched};
use crate::protocol::StateRejection;
use crate::test_support::{next_revision, object_mut};

/// The revision the app has applied.
fn applied_revision(app: &App) -> u64 {
    app.world().resource::<AppliedAuthoring>().revision()
}

/// The same snapshot sent again by a restarted editor (a new session, starting over at a lower
/// revision) is applied without spawning a second entity for any light.
#[test]
fn a_restarted_editor_resending_the_state_keeps_the_same_entities() {
    let (mut app, state) = app_with_sample();
    let entities_before = light_entities(&mut app);
    let restarted = AuthoredState {
        session_id: format!("{} restarted", state.session_id),
        revision: 1,
        ..state.clone()
    };
    assert!(restarted.revision < state.revision);
    assert_eq!(
        state_send(&mut app, restarted.clone()),
        Ok(RevisionVerdict::NewSession)
    );
    assert_eq!(applied_revision(&app), restarted.revision);
    assert_eq!(light_entities(&mut app), entities_before);
    assert_lights_match(&mut app, &restarted);
}

/// A resend of the applied revision is ignored, and applying the same snapshot again directly
/// keeps exactly one entity per light, the same ones.
#[test]
fn applying_the_same_state_twice_keeps_one_entity_per_light() {
    let (mut app, state) = app_with_sample();
    let entities_before = light_entities(&mut app);
    assert_eq!(
        state_send(&mut app, state.clone()),
        Ok(RevisionVerdict::Repeat)
    );
    assert_eq!(light_entities(&mut app), entities_before);
    app.world_mut().resource_mut::<AppliedAuthoring>().state = Some(state.clone());
    app.update();
    assert_eq!(light_entities(&mut app), entities_before);
    assert_lights_match(&mut app, &state);
}

/// A snapshot older than the applied one in the same session is reported stale and changes
/// nothing.
#[test]
fn stale_revisions_are_not_applied() {
    let (mut app, state) = app_with_sample();
    let id = first_light_id(&state);
    let mut newest = next_revision(&next_revision(&state));
    object_mut(&mut newest, &id).translation[0] += 1.0;
    assert_eq!(
        state_send(&mut app, newest.clone()),
        Ok(RevisionVerdict::Newer)
    );
    let mut late = next_revision(&state);
    assert!(late.revision < newest.revision);
    object_mut(&mut late, &id).translation[0] -= 7.0;
    assert_eq!(
        state_send(&mut app, late.clone()),
        Ok(RevisionVerdict::Stale)
    );
    assert_eq!(applied_revision(&app), newest.revision);
    assert_lights_match(&mut app, &newest);
}

/// Snapshots with a duplicated id or a non-finite transform are rejected; the lights, the applied
/// revision and the received revision stay as they were.
#[test]
fn invalid_states_are_rejected_and_previous_lights_stay() {
    let (mut app, state) = app_with_sample();
    let entities_before = light_entities(&mut app);
    let id = first_light_id(&state);
    let mut duplicated = next_revision(&state);
    let copy = duplicated.object(&id).expect("light").clone();
    duplicated.objects.push(copy);
    assert_eq!(
        state_send(&mut app, duplicated),
        Err(StateRejection::DuplicateObjectId(id.clone()))
    );
    let mut non_finite = next_revision(&state);
    object_mut(&mut non_finite, &id).translation[2] = f32::INFINITY;
    assert_eq!(
        state_send(&mut app, non_finite),
        Err(StateRejection::NonFiniteTransform(id.clone()))
    );
    assert_eq!(applied_revision(&app), state.revision);
    let received = app.world().resource::<AuthoringInbox>().received_revision();
    assert_eq!(received, state.revision);
    assert_eq!(light_entities(&mut app), entities_before);
    assert_lights_match(&mut app, &state);
}

/// Applying another document announces the switch and replaces every light of the previous
/// document with the new document's own entities.
#[test]
fn switching_documents_despawns_the_previous_documents_lights() {
    let (mut app, state) = app_with_sample();
    let entities_before = light_entities(&mut app);
    app.world_mut()
        .resource_mut::<Messages<DocumentSwitched>>()
        .clear();
    let other = AuthoredState {
        document_id: format!("{} other", state.document_id),
        ..state.clone()
    };
    assert_eq!(
        state_send(&mut app, other.clone()),
        Ok(RevisionVerdict::NewSession)
    );
    for entity in entities_before.values() {
        assert!(app.world().get_entity(*entity).is_err());
    }
    assert_lights_match(&mut app, &other);
    let switches: Vec<DocumentSwitched> = app
        .world_mut()
        .resource_mut::<Messages<DocumentSwitched>>()
        .drain()
        .collect();
    let switch = switches.last().expect("the switch is announced");
    assert_eq!(switch.previous.as_deref(), Some(state.document_id.as_str()));
    assert_eq!(switch.current, other.document_id);
}
