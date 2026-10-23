//! Status tests: room and portal counts of the applied snapshot, the reported culling state and
//! the failed geometry revision.

use bevy::prelude::*;
use dynlight::portals::PortalState;
use dynlight::prelude::DynamicLightingSettings;

use super::refresh::{portal_culling, refresh_portal_status, refresh_status};
use super::{BridgeStatus, PortalCullingState};
use crate::level::LevelGeometry;
use crate::protocol::AuthoredObjectKind;
use crate::test_support::{authoring_app, next_revision, sample_state, state_send};

/// A headless app that applies authored state and refreshes the status every frame.
fn status_app() -> App {
    let mut app = authoring_app();
    app.init_resource::<LevelGeometry>()
        .init_resource::<DynamicLightingSettings>()
        .insert_resource(BridgeStatus::new("status tests"))
        .add_systems(Update, (refresh_status, refresh_portal_status));
    app
}

/// How many objects of `kind` the sample state has.
fn sample_count_of_kind(kind: AuthoredObjectKind) -> usize {
    let state = sample_state();
    state
        .objects
        .iter()
        .filter(|object| object.kind == kind)
        .count()
}

/// The status counts the sample's rooms and portals, and follows a deleted portal.
#[test]
fn status_counts_the_applied_rooms_and_portals() {
    let mut app = status_app();
    let state = sample_state();
    state_send(&mut app, state.clone()).expect("the sample state is valid");
    app.update();
    let rooms = sample_count_of_kind(AuthoredObjectKind::Room);
    let portals = sample_count_of_kind(AuthoredObjectKind::Portal);
    assert!(rooms > 0 && portals > 0);
    let status = app.world().resource::<BridgeStatus>();
    assert_eq!((status.room_count, status.portal_count), (rooms, portals));
    assert_eq!(status.portal_state, PortalCullingState::Empty);
    assert_eq!(status.geometry_revision_failed, 0);
    let mut edited = next_revision(&state);
    edited
        .objects
        .retain(|object| object.kind != AuthoredObjectKind::Portal);
    state_send(&mut app, edited).expect("the edit is valid");
    app.update();
    let status = app.world().resource::<BridgeStatus>();
    assert_eq!((status.room_count, status.portal_count), (rooms, 0));
}

/// Each DynLight portal state maps to the reported culling state, keeping a disabled graph's
/// reason.
#[test]
fn portal_states_map_to_the_reported_culling_state() {
    let reason = String::from("room Hall does not reach the door");
    let disabled = PortalState::Disabled(reason.clone());
    let none = portal_culling(None);
    assert_eq!(none, (PortalCullingState::Empty, None));
    let empty = portal_culling(Some(&PortalState::Empty));
    assert_eq!(empty, (PortalCullingState::Empty, None));
    let ready = portal_culling(Some(&PortalState::Ready));
    assert_eq!(ready, (PortalCullingState::Active, None));
    let off = portal_culling(Some(&disabled));
    assert_eq!(off, (PortalCullingState::Disabled, Some(reason)));
}
