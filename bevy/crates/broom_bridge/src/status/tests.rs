//! Status tests: the applied revision with or without DynLight, room and portal counts of the
//! applied snapshot, the reported culling state and the failed geometry revision.

use bevy::prelude::*;

use super::{BridgeStatus, PortalCullingState, StatusPlugin};
use crate::level::LevelGeometry;
use crate::protocol::AuthoredObjectKind;
use crate::test_support::{authoring_app, sample_state, state_send};

/// A headless app that applies authored state and refreshes the status every frame with the
/// status plugin. Only a DynLight build gets DynLight's settings, which it needs.
fn status_app() -> App {
    let mut app = authoring_app();
    app.init_resource::<LevelGeometry>()
        .insert_resource(BridgeStatus::new("status tests"))
        .add_plugins(StatusPlugin);
    #[cfg(feature = "dynlight")]
    app.init_resource::<dynlight::prelude::DynamicLightingSettings>();
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

/// The status reports the applied document and revision.
#[test]
fn status_reports_the_applied_document_and_revision() {
    let mut app = status_app();
    let state = sample_state();
    state_send(&mut app, state.clone()).expect("the sample state is valid");
    app.update();
    let status = app.world().resource::<BridgeStatus>();
    assert_eq!(
        status.document_id.as_deref(),
        Some(state.document_id.as_str())
    );
    assert_eq!(status.state_revision_received, state.revision);
    assert_eq!(status.state_revision_applied, state.revision);
    assert_eq!(status.geometry_revision_failed, 0);
}

/// Without DynLight the status refreshes without DynLight's settings, and the light, room and
/// portal fields stay empty although the snapshot has lights, rooms and portals.
#[cfg(not(feature = "dynlight"))]
#[test]
fn status_without_dynlight_counts_no_lights_rooms_or_portals() {
    let mut app = status_app();
    let state = sample_state();
    assert!(sample_count_of_kind(AuthoredObjectKind::Light) > 0);
    state_send(&mut app, state.clone()).expect("the sample state is valid");
    app.update();
    let status = app.world().resource::<BridgeStatus>();
    assert_eq!(status.state_revision_applied, state.revision);
    assert_eq!((status.light_count, status.realtime_light_budget), (0, 0));
    assert_eq!((status.room_count, status.portal_count), (0, 0));
    assert_eq!(status.portal_state, PortalCullingState::Empty);
}

/// The status counts the sample's rooms and portals, and follows a deleted portal.
#[cfg(feature = "dynlight")]
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
    let mut edited = crate::test_support::next_revision(&state);
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
#[cfg(feature = "dynlight")]
#[test]
fn portal_states_map_to_the_reported_culling_state() {
    use super::refresh_dynlight::portal_culling;
    use dynlight::portals::PortalState;

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
