//! Preview bake tests in a headless app: when bakes start, which finished bakes are applied, and
//! the bake state reported to the editor.

use std::marker::PhantomData;

use bevy::asset::uuid::Uuid;
use bevy::ecs::message::Messages;
use bevy::prelude::*;
use dynlight::bake::{
    BakeFailure, BakeFinished, BakePreset, BakeReport, BakeRequest, BakeStats, BakeStatus,
    DynLightBake,
};
use dynlight::baked_lighting::ActiveBake;

use super::{BakeLink, BakeLinkPlugin, bake_fingerprint};
use crate::level::{LevelGeometry, ShownGeometry};
use crate::protocol::{
    AuthoredEffectKind, AuthoredIllumination, AuthoredLight, AuthoredLightEffect,
    AuthoredObjectKind, AuthoredState, geometry_file_name,
};
use crate::status::{BakeState, BridgeStatus};
use crate::test_support::{
    authoring_app, glb_publication, next_revision, object_mut, sample_state, state_send,
};

/// Geometry of `state`'s document shown from the file of `geometry_revision`, rooted at `root`.
fn shown_geometry(state: &AuthoredState, geometry_revision: u64, root: Entity) -> ShownGeometry {
    ShownGeometry {
        document_id: state.document_id.clone(),
        level_name: "level".into(),
        geometry_revision,
        file_name: geometry_file_name(geometry_revision),
        root,
    }
}

/// Replaces the app's geometry pipeline with one that shows `state`'s geometry and is idle.
fn geometry_show(app: &mut App, state: &AuthoredState) {
    let root = app.world_mut().spawn_empty().id();
    let mut level = LevelGeometry::default();
    level.set_shown_for_test(shown_geometry(state, state.geometry_revision, root));
    app.insert_resource(level);
}

/// A headless app with the authoring and bake link plugins and DynLight's bake resources and
/// messages, showing the sample state's geometry; and that state.
fn bake_app() -> (App, AuthoredState) {
    let mut app = authoring_app();
    app.add_plugins(BakeLinkPlugin)
        .init_resource::<BakeStatus>()
        .init_resource::<ActiveBake>()
        .insert_resource(BridgeStatus::new("bake tests"))
        .add_message::<BakeRequest>()
        .add_message::<BakeFinished>();
    let state = sample_state();
    geometry_show(&mut app, &state);
    state_send(&mut app, state.clone()).expect("the sample state is valid");
    (app, state)
}

/// The bake requests the app sent since the last call.
fn bake_requests_drain(app: &mut App) -> Vec<BakeRequest> {
    app.world_mut()
        .resource_mut::<Messages<BakeRequest>>()
        .drain()
        .collect()
}

/// Asks for a preview bake and runs one frame.
fn bake_request(app: &mut App) {
    app.world_mut().resource_mut::<BakeLink>().request();
    app.update();
}

/// Asks for a preview bake and checks that exactly one in-memory preview bake was sent.
fn bake_request_and_expect_start(app: &mut App) {
    bake_request(app);
    let requests = bake_requests_drain(app);
    let expected = BakeRequest {
        output: None,
        preset: BakePreset::Preview,
    };
    assert_eq!(requests, vec![expected]);
    assert_eq!(bake_state(app), BakeState::Baking);
}

/// Delivers DynLight's end of the running bake with `result` and runs one frame.
fn bake_finish(app: &mut App, result: Result<BakeReport, BakeFailure>) {
    app.world_mut().write_message(BakeFinished {
        output: None,
        result,
    });
    app.update();
}

/// A successful bake result for a new in-memory bake asset, and that asset's handle.
fn bake_success() -> (Result<BakeReport, BakeFailure>, Handle<DynLightBake>) {
    let handle = Handle::<DynLightBake>::Uuid(Uuid::new_v4(), PhantomData);
    let report = BakeReport {
        handle: handle.clone(),
        stats: BakeStats::default(),
        milliseconds: 1,
        bytes: 1,
    };
    (Ok(report), handle)
}

/// The bake state reported to the editor.
fn bake_state(app: &App) -> BakeState {
    app.world().resource::<BridgeStatus>().bake_state
}

/// The bake the scene is lit with.
fn active_bake(app: &App) -> Option<Handle<DynLightBake>> {
    app.world().resource::<ActiveBake>().0.clone()
}

/// The id of a light in `state` that is baked: enabled and not realtime.
fn baked_light_id(state: &AuthoredState) -> String {
    state
        .objects
        .iter()
        .filter(|object| object.kind == AuthoredObjectKind::Light)
        .find(|object| {
            object
                .light
                .as_ref()
                .is_some_and(|light| light.enabled && !light.realtime)
        })
        .map(|object| object.id.clone())
        .expect("the sample has a baked light")
}

/// Bakes the unchanged scene once and returns the applied bake's handle.
fn bake_completed(app: &mut App) -> Handle<DynLightBake> {
    bake_request_and_expect_start(app);
    let (result, handle) = bake_success();
    bake_finish(app, result);
    assert_eq!(active_bake(app), Some(handle.clone()));
    assert_eq!(bake_state(app), BakeState::Current);
    handle
}

/// A requested bake is held back while a geometry revision is waiting to load, reported as
/// waiting, and sent once the geometry is shown and nothing loads.
#[test]
fn requested_bake_waits_while_geometry_is_loading() {
    let (mut app, state) = bake_app();
    let next_geometry = state.geometry_revision + 1;
    let publication = glb_publication(&state, next_geometry, b"loading");
    let mut level = app.world_mut().resource_mut::<LevelGeometry>();
    level
        .receive(publication)
        .expect("the publication is valid");
    assert!(level.busy());
    bake_request(&mut app);
    app.update();
    assert!(bake_requests_drain(&mut app).is_empty());
    let status = app.world().resource::<BridgeStatus>();
    assert_eq!(status.bake_state, BakeState::Baking);
    assert!(status.bake_message.is_some());
    let loaded = AuthoredState {
        geometry_revision: next_geometry,
        ..state
    };
    geometry_show(&mut app, &loaded);
    app.update();
    let requests = bake_requests_drain(&mut app);
    assert_eq!(requests.len(), 1);
    assert_eq!(requests[0].output, None);
    assert_eq!(requests[0].preset, BakePreset::Preview);
    assert_eq!(app.world().resource::<BridgeStatus>().bake_message, None);
}

/// A bake that finishes while the scene is unchanged becomes the active bake and is current.
#[test]
fn finished_bake_of_an_unchanged_scene_is_applied() {
    let (mut app, _state) = bake_app();
    assert_eq!(bake_state(&app), BakeState::NoBake);
    assert_eq!(active_bake(&app), None);
    bake_completed(&mut app);
}

/// A bake that finishes after a baked light moved is dropped: the previous bake stays active and
/// the state reports that a new bake is needed.
#[test]
fn bake_finished_after_a_light_moved_is_dropped() {
    let (mut app, state) = bake_app();
    let first_bake = bake_completed(&mut app);
    bake_request_and_expect_start(&mut app);
    let mut moved = next_revision(&state);
    object_mut(&mut moved, &baked_light_id(&state)).translation[1] += 0.5;
    state_send(&mut app, moved).expect("the move is valid");
    assert_eq!(bake_state(&app), BakeState::Baking);
    let (result, late_bake) = bake_success();
    bake_finish(&mut app, result);
    assert_ne!(active_bake(&app), Some(late_bake));
    assert_eq!(active_bake(&app), Some(first_bake));
    assert_eq!(bake_state(&app), BakeState::NeedsBake);
}

/// Changing only a baked light's color and intensity, which DynLight evaluates live, keeps the
/// shown bake current; moving the light afterwards does not.
#[test]
fn color_and_intensity_changes_keep_the_bake_current() {
    let (mut app, state) = bake_app();
    let bake = bake_completed(&mut app);
    let id = baked_light_id(&state);
    let mut recolored = next_revision(&state);
    let light = object_mut(&mut recolored, &id)
        .light
        .as_mut()
        .expect("light");
    light.color = [light.color[2], light.color[0], light.color[1] * 0.5];
    light.intensity = light.intensity * 2.0 + 1.0;
    state_send(&mut app, recolored.clone()).expect("the edit is valid");
    assert_eq!(bake_state(&app), BakeState::Current);
    assert_eq!(active_bake(&app), Some(bake));
    let mut moved = next_revision(&recolored);
    object_mut(&mut moved, &id).translation[0] -= 0.25;
    state_send(&mut app, moved).expect("the move is valid");
    assert_eq!(bake_state(&app), BakeState::NeedsBake);
}

/// A failed bake leaves the active bake alone and reports the failure.
#[test]
fn failed_bake_is_reported_and_not_applied() {
    let (mut app, _state) = bake_app();
    bake_request_and_expect_start(&mut app);
    bake_finish(&mut app, Err(BakeFailure::Busy));
    assert_eq!(active_bake(&app), None);
    let status = app.world().resource::<BridgeStatus>();
    assert_eq!(status.bake_state, BakeState::Failed);
    assert!(status.bake_message.is_some());
}

/// A first bake that finishes after a baked light moved is dropped, and with no bake shown the
/// state reports that a bake is needed rather than that none was ever made.
#[test]
fn stale_first_bake_reports_that_a_bake_is_needed() {
    let (mut app, state) = bake_app();
    bake_request_and_expect_start(&mut app);
    let mut moved = next_revision(&state);
    object_mut(&mut moved, &baked_light_id(&state)).translation[2] += 0.5;
    state_send(&mut app, moved).expect("the move is valid");
    let (result, late_bake) = bake_success();
    bake_finish(&mut app, result);
    assert_ne!(active_bake(&app), Some(late_bake));
    assert_eq!(active_bake(&app), None);
    assert_eq!(bake_state(&app), BakeState::NeedsBake);
}

/// Moving, resizing or closing rooms and portals never changes the bake fingerprint, while
/// moving a baked light does.
#[test]
fn rooms_and_portals_do_not_change_the_bake_fingerprint() {
    let state = sample_state();
    let file = geometry_file_name(state.geometry_revision);
    let original = bake_fingerprint(&state, &file);
    let mut edited = next_revision(&state);
    for object in &mut edited.objects {
        if let Some(room) = object.room.as_mut() {
            room.half_size[0] += 1.0;
            object.translation[0] += 2.0;
        }
        if let Some(portal) = object.portal.as_mut() {
            portal.closed = !portal.closed;
            object.rotation = Quat::from_rotation_y(0.5).to_array();
        }
    }
    assert_ne!(edited.objects, state.objects);
    assert_eq!(bake_fingerprint(&edited, &file), original);
    object_mut(&mut edited, &baked_light_id(&state)).translation[0] += 1.0;
    assert_ne!(bake_fingerprint(&edited, &file), original);
}

/// The settings of light `id` in `state`, for editing in place.
fn light_mut<'a>(state: &'a mut AuthoredState, id: &str) -> &'a mut AuthoredLight {
    object_mut(state, id)
        .light
        .as_mut()
        .expect("the object is a light")
}

/// Live-only light features such as an effect or fog keep the bake fingerprint, while the
/// illumination mode, which the bake stores, changes it.
#[test]
fn only_bake_relevant_light_settings_change_the_bake_fingerprint() {
    let state = sample_state();
    let file = geometry_file_name(state.geometry_revision);
    let original = bake_fingerprint(&state, &file);
    let id = baked_light_id(&state);
    let mut live = next_revision(&state);
    let light = light_mut(&mut live, &id);
    light.effect = Some(AuthoredLightEffect {
        kind: AuthoredEffectKind::Candle,
        ..default()
    });
    light.fog = None;
    light.intensity += 1.0;
    assert_eq!(bake_fingerprint(&live, &file), original);
    light_mut(&mut live, &id).illumination = match state
        .object(&id)
        .and_then(|object| object.light.as_ref())
        .map(|light| light.illumination)
    {
        Some(AuthoredIllumination::SingleBounce) => AuthoredIllumination::Direct,
        _ => AuthoredIllumination::SingleBounce,
    };
    assert_ne!(bake_fingerprint(&live, &file), original);
}
