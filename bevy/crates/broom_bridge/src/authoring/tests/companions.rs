//! A light's effect, fog and cookie follow the snapshot as DynLight components next to the
//! light: inserted, updated in place and removed, with cookie paths outside the assets folder
//! refused and reported once.

use bevy::prelude::*;
use dynlight::cookies::LightCookie;
use dynlight::effects::{LightEffect, LightEffectState};
use dynlight::fog::VolumetricLight;

use super::*;
use crate::authoring::AuthoredLightCookiePath;
use crate::protocol::AuthoredLight;
use crate::status::BridgeStatus;
use crate::test_support::{next_revision, object_mut};

/// An authoring app that can load images and records errors in a status.
fn app_with_assets() -> App {
    let mut app = authoring_app();
    app.add_plugins(AssetPlugin::default())
        .init_asset::<Image>()
        .insert_resource(BridgeStatus::new("test"));
    app
}

/// The id of the first light in `state` that has `wanted` companions.
fn light_id_where(state: &AuthoredState, wanted: impl Fn(&AuthoredLight) -> bool) -> String {
    state
        .objects
        .iter()
        .find(|object| object.light.as_ref().is_some_and(&wanted))
        .map(|object| object.id.clone())
        .expect("the sample has such a light")
}

/// The settings of light `id` in `state`, for editing in place.
fn light_mut<'a>(state: &'a mut AuthoredState, id: &str) -> &'a mut AuthoredLight {
    object_mut(state, id)
        .light
        .as_mut()
        .expect("the object is a light")
}

/// The spawned entity of light `id`.
fn entity_of(app: &mut App, id: &str) -> Entity {
    light_entities(app)
        .get(id)
        .copied()
        .unwrap_or_else(|| panic!("light {id} is spawned"))
}

/// How many errors `app`'s status has recorded.
fn error_count(app: &App) -> usize {
    app.world().resource::<BridgeStatus>().errors.len()
}

/// The sample's spot light gets the effect, fog and cookie it was authored with.
#[test]
fn authored_companions_are_inserted_next_to_the_light() {
    let mut app = app_with_assets();
    let state = sample_state();
    let id = light_id_where(&state, |light| {
        light.effect.is_some() && light.fog.is_some() && light.cookie.is_some()
    });
    state_send(&mut app, state.clone()).expect("the sample is valid");
    let authored = state.object(&id).and_then(|object| object.light.clone());
    let authored = authored.expect("the light has settings");
    let entity = entity_of(&mut app, &id);
    let entity = app.world().entity(entity);
    let effect = authored.effect.expect("an effect").to_dynlight();
    assert_eq!(entity.get::<LightEffect>(), Some(&effect));
    let fog = authored.fog.expect("a fog").to_dynlight();
    assert_eq!(entity.get::<VolumetricLight>(), Some(&fog));
    let cookie_path = authored.cookie.expect("a cookie");
    let cookie = entity.get::<LightCookie>().expect("a cookie is loaded");
    assert_eq!(
        cookie.0.path().map(ToString::to_string),
        Some(cookie_path.clone())
    );
    assert_eq!(
        entity.get::<AuthoredLightCookiePath>(),
        Some(&AuthoredLightCookiePath(cookie_path))
    );
    assert_eq!(error_count(&app), 0);
}

/// Changing a companion updates it on the same entity; dropping them removes the components,
/// including the effect's running state so the light returns to full intensity.
#[test]
fn companions_update_in_place_and_are_removed() {
    let mut app = app_with_assets();
    let state = sample_state();
    let id = light_id_where(&state, |light| {
        light.effect.is_some() && light.fog.is_some()
    });
    state_send(&mut app, state.clone()).expect("the sample is valid");
    let entity = entity_of(&mut app, &id);
    let mut faster = next_revision(&state);
    let effect = light_mut(&mut faster, &id).effect.as_mut().expect("effect");
    effect.pulse_speed *= 2.0;
    let expected = effect.to_dynlight();
    state_send(&mut app, faster.clone()).expect("a faster effect is valid");
    assert_eq!(entity_of(&mut app, &id), entity);
    assert_eq!(app.world().get::<LightEffect>(entity), Some(&expected));
    let mut plain = next_revision(&faster);
    let light = light_mut(&mut plain, &id);
    (light.effect, light.fog, light.cookie) = (None, None, None);
    state_send(&mut app, plain).expect("a plain light is valid");
    let entity = app.world().entity(entity);
    assert!(!entity.contains::<LightEffect>());
    assert!(!entity.contains::<LightEffectState>());
    assert!(!entity.contains::<VolumetricLight>());
    assert!(!entity.contains::<LightCookie>());
    assert!(!entity.contains::<AuthoredLightCookiePath>());
}

/// A light without companions gets them when they are authored later.
#[test]
fn companions_are_added_to_an_existing_light() {
    let mut app = app_with_assets();
    let mut state = sample_state();
    let id = light_id_where(&state, |light| light.fog.is_some());
    let fog = light_mut(&mut state, &id).fog.take().expect("a fog");
    state_send(&mut app, state.clone()).expect("the sample is valid");
    let entity = entity_of(&mut app, &id);
    assert!(!app.world().entity(entity).contains::<VolumetricLight>());
    let mut foggy = next_revision(&state);
    light_mut(&mut foggy, &id).fog = Some(fog);
    state_send(&mut app, foggy).expect("a foggy light is valid");
    assert_eq!(
        app.world().get::<VolumetricLight>(entity),
        Some(&fog.to_dynlight())
    );
}

/// A cookie path that leaves the assets folder is reported once, loads nothing, and the light
/// keeps shining.
#[test]
fn cookie_paths_outside_the_assets_folder_are_refused() {
    let mut app = app_with_assets();
    let mut state = sample_state();
    let id = light_id_where(&state, |light| light.cookie.is_some());
    light_mut(&mut state, &id).cookie = Some("../outside.png".into());
    state_send(&mut app, state.clone()).expect("the state is valid");
    let entity = entity_of(&mut app, &id);
    assert!(!app.world().entity(entity).contains::<LightCookie>());
    assert!(app.world().entity(entity).contains::<DynamicLight>());
    assert_eq!(error_count(&app), 1);
    state_send(&mut app, next_revision(&state)).expect("the same state is valid");
    assert_eq!(
        error_count(&app),
        1,
        "an unchanged path is not reported again"
    );
}
