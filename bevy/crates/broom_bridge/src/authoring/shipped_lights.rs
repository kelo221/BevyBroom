//! Lights of shipped levels. The editor's GLB export writes each light node's complete
//! [`AuthoredLight`] under `broom_light` and the light's editor id under `broom_light_of`, next to
//! the `dynlight_*` keys DynLight's own glTF import reads. The complete settings (shadow mode,
//! bounce, cookie, fog density, effect timing and the rest) are applied on top of what DynLight
//! imported.
//!
//! While the shown document has an object with the same editor id, from the live editor or a
//! level manifest, the bridge's own light stands for it and the shipped light is switched off,
//! so a level loaded both ways lights each light once. The shipped light comes back when the
//! shown document no longer has that id.

use std::collections::HashSet;

use bevy::gltf::GltfExtras;
use bevy::prelude::*;
use dynlight::cookies::LightCookie;
use dynlight::effects::{LightEffect, LightEffectState};
use dynlight::fog::VolumetricLight;
use dynlight::light::DynamicLight;

use super::AppliedAuthoring;
use super::light_companions::{
    AuthoredLightCookiePath, CookieLoader, LightCompanions, companions_insert,
};
use crate::protocol::{AuthoredLight, EXTRAS_LIGHT, EXTRAS_LIGHT_OF};
use crate::status::BridgeStatus;

/// A light node of a shipped level, with the editor id of its light.
#[derive(Component, Reflect, Clone, Debug, PartialEq, Eq)]
#[reflect(Component)]
pub struct ShippedLight(pub String);

/// The complete settings a shipped light node was exported with.
#[derive(Component, Clone, Debug, PartialEq)]
pub struct ShippedLightSettings(pub AuthoredLight);

/// Marks a shipped light that is switched off because the shown document has its editor id.
#[derive(Component, Reflect, Clone, Copy, Debug, Default, PartialEq, Eq)]
#[reflect(Component)]
pub struct ShippedLightReplaced;

/// The editor id and settings in a light node's extras JSON: `None` when the node has neither
/// key, an error when the settings are malformed or invalid.
pub(crate) fn shipped_light_from_extras(
    json: &str,
) -> Option<Result<(String, AuthoredLight), String>> {
    let value: serde_json::Value = serde_json::from_str(json).ok()?;
    let id = value
        .get(EXTRAS_LIGHT_OF)?
        .as_str()
        .filter(|id| !id.is_empty())?;
    let settings = value.get(EXTRAS_LIGHT)?.clone();
    Some(shipped_light_parse(id, settings))
}

/// Reads and validates the settings of shipped light `id`.
fn shipped_light_parse(
    id: &str,
    settings: serde_json::Value,
) -> Result<(String, AuthoredLight), String> {
    let light = serde_json::from_value::<AuthoredLight>(settings)
        .map_err(|error| format!("shipped light {id}: {error}"))?;
    light
        .validate()
        .map_err(|error| format!("shipped light {id}: {error}"))?;
    Ok((id.to_owned(), light))
}

/// Records `message` in the status when there is one, and logs it otherwise.
fn error_report(status: Option<&mut BridgeStatus>, message: String) {
    match status {
        Some(status) => status.report_error(message),
        None => warn!("broom bridge: {message}"),
    }
}

/// Tags newly spawned light nodes of shipped levels and applies their complete settings.
/// Malformed settings are reported and leave the node as DynLight imported it.
pub(super) fn read_shipped_lights(
    mut commands: Commands,
    nodes: Query<(Entity, &GltfExtras), Added<GltfExtras>>,
    assets: Option<Res<AssetServer>>,
    images: Option<Res<Assets<Image>>>,
    mut status: Option<ResMut<BridgeStatus>>,
) {
    for (entity, extras) in &nodes {
        let (id, light) = match shipped_light_from_extras(&extras.value) {
            None => continue,
            Some(Err(error)) => {
                error_report(status.as_deref_mut(), error);
                continue;
            }
            Some(Ok(shipped)) => shipped,
        };
        let mut loader = CookieLoader {
            assets: assets.as_deref().filter(|_| images.is_some()),
            status: status.as_deref_mut(),
        };
        let mut node = commands.entity(entity);
        switch_on(&mut node, &light, &mut loader);
        node.insert((ShippedLight(id), ShippedLightSettings(light)));
    }
}

/// Switches shipped lights off while the shown document has their editor id, and back on when
/// it no longer does. Runs when the shown document changes or shipped lights appear.
pub(super) fn replace_shipped_lights(
    mut commands: Commands,
    applied: Res<AppliedAuthoring>,
    added: Query<(), Added<ShippedLight>>,
    shipped: Query<(
        Entity,
        &ShippedLight,
        &ShippedLightSettings,
        Has<ShippedLightReplaced>,
    )>,
    assets: Option<Res<AssetServer>>,
    images: Option<Res<Assets<Image>>>,
    mut status: Option<ResMut<BridgeStatus>>,
) {
    if !applied.is_changed() && added.is_empty() {
        return;
    }
    let shown_ids = shown_object_ids(&applied);
    let mut loader = CookieLoader {
        assets: assets.as_deref().filter(|_| images.is_some()),
        status: status.as_deref_mut(),
    };
    for (entity, shipped, settings, is_replaced) in &shipped {
        let is_shown = shown_ids.contains(shipped.0.as_str());
        if is_shown == is_replaced {
            continue;
        }
        let mut node = commands.entity(entity);
        if is_shown {
            switch_off(&mut node);
        } else {
            node.remove::<ShippedLightReplaced>();
            switch_on(&mut node, &settings.0, &mut loader);
        }
    }
}

/// The ids of every object of the shown document.
fn shown_object_ids(applied: &AppliedAuthoring) -> HashSet<&str> {
    applied
        .state
        .iter()
        .flat_map(|state| state.objects.iter())
        .map(|object| object.id.as_str())
        .collect()
}

/// Gives a node the DynLight light and companions `light` describes; a disabled light stays
/// dark.
fn switch_on(node: &mut EntityCommands, light: &AuthoredLight, loader: &mut CookieLoader) {
    if !light.enabled {
        switch_off_components(node);
        return;
    }
    node.insert(light.to_dynamic_light());
    node.remove::<(
        LightEffect,
        LightEffectState,
        VolumetricLight,
        LightCookie,
        AuthoredLightCookiePath,
    )>();
    companions_insert(node, &LightCompanions::of(light), loader);
}

/// Switches a shipped light off and marks it replaced.
fn switch_off(node: &mut EntityCommands) {
    switch_off_components(node);
    node.insert(ShippedLightReplaced);
}

/// Removes the DynLight light and its companions from a node.
fn switch_off_components(node: &mut EntityCommands) {
    node.remove::<(
        DynamicLight,
        LightEffect,
        LightEffectState,
        VolumetricLight,
        LightCookie,
        AuthoredLightCookiePath,
    )>();
}
