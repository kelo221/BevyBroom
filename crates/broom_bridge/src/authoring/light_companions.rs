//! DynLight components that ride along with an authored light: its intensity effect, its fog
//! volume and its cookie texture. Each is inserted, updated or removed to match the snapshot,
//! and only written when it really changes.

use bevy::ecs::query::QueryData;
use bevy::prelude::*;
use dynlight::cookies::LightCookie;
use dynlight::effects::{LightEffect, LightEffectState};
use dynlight::fog::VolumetricLight;

use crate::protocol::{AuthoredFog, AuthoredLight, AuthoredLightEffect, is_contained_path};
use crate::status::BridgeStatus;

/// The cookie path an authored light last asked for, whether or not it could be loaded.
#[derive(Component, Reflect, Clone, Debug, PartialEq, Eq)]
#[reflect(Component, Debug, PartialEq, Clone)]
pub struct AuthoredLightCookiePath(pub String);

/// The companion components one authored light should have.
#[derive(Clone, Debug, PartialEq)]
pub(crate) struct LightCompanions {
    pub effect: Option<LightEffect>,
    pub fog: Option<VolumetricLight>,
    /// Asset path of the cookie image.
    pub cookie: Option<String>,
}

impl LightCompanions {
    /// The companions `light` asks for. An empty cookie path means no cookie.
    pub(crate) fn of(light: &AuthoredLight) -> Self {
        Self {
            effect: light.effect.as_ref().map(AuthoredLightEffect::to_dynlight),
            fog: light.fog.as_ref().map(AuthoredFog::to_dynlight),
            cookie: light.cookie.clone().filter(|path| !path.trim().is_empty()),
        }
    }
}

/// The companion components a light entity has now.
#[derive(QueryData)]
#[query_data(mutable)]
pub(super) struct CurrentCompanions {
    effect: Option<&'static mut LightEffect>,
    fog: Option<&'static mut VolumetricLight>,
    cookie_path: Option<&'static AuthoredLightCookiePath>,
}

/// Loads cookie images, and reports the paths it refuses.
pub(super) struct CookieLoader<'a> {
    pub assets: Option<&'a AssetServer>,
    pub status: Option<&'a mut BridgeStatus>,
}

impl CookieLoader<'_> {
    /// The image at `path` inside the game's assets folder, or `None` when the path leaves the
    /// folder (reported) or the app has no asset server.
    fn load(&mut self, path: &str) -> Option<Handle<Image>> {
        if !is_contained_path(path) {
            let message = format!("light cookie {path:?} is not a path inside the assets folder");
            match self.status.as_deref_mut() {
                Some(status) => status.report_error(message),
                None => warn!("broom bridge: {message}"),
            }
            return None;
        }
        self.assets.map(|assets| assets.load(path.to_owned()))
    }
}

/// Brings the companions of a light entity from `current` to `target`.
pub(super) fn companions_sync(
    commands: &mut EntityCommands,
    current: CurrentCompanionsItem,
    target: &LightCompanions,
    loader: &mut CookieLoader,
) {
    effect_sync(commands, current.effect, target.effect);
    fog_sync(commands, current.fog, target.fog);
    cookie_sync(
        commands,
        current.cookie_path,
        target.cookie.as_deref(),
        loader,
    );
}

/// Adds the companions of `target` to a light entity that has none yet.
pub(super) fn companions_insert(
    commands: &mut EntityCommands,
    target: &LightCompanions,
    loader: &mut CookieLoader,
) {
    effect_sync(commands, None, target.effect);
    fog_sync(commands, None, target.fog);
    cookie_sync(commands, None, target.cookie.as_deref(), loader);
}

/// Inserts, updates or removes the light effect. Its running state goes with it so a removed
/// effect leaves the light at full intensity.
fn effect_sync(
    commands: &mut EntityCommands,
    current: Option<Mut<LightEffect>>,
    target: Option<LightEffect>,
) {
    match (current, target) {
        (Some(mut current), Some(target)) => {
            current.set_if_neq(target);
        }
        (Some(_), None) => {
            commands.remove::<(LightEffect, LightEffectState)>();
        }
        (None, Some(target)) => {
            commands.insert(target);
        }
        (None, None) => {}
    }
}

/// Inserts, updates or removes the fog volume.
fn fog_sync(
    commands: &mut EntityCommands,
    current: Option<Mut<VolumetricLight>>,
    target: Option<VolumetricLight>,
) {
    match (current, target) {
        (Some(mut current), Some(target)) => {
            current.set_if_neq(target);
        }
        (Some(_), None) => {
            commands.remove::<VolumetricLight>();
        }
        (None, Some(target)) => {
            commands.insert(target);
        }
        (None, None) => {}
    }
}

/// Loads, swaps or removes the cookie when its path changes. A path that cannot be loaded leaves
/// the light without a cookie.
fn cookie_sync(
    commands: &mut EntityCommands,
    current: Option<&AuthoredLightCookiePath>,
    target: Option<&str>,
    loader: &mut CookieLoader,
) {
    if current.map(|path| path.0.as_str()) == target {
        return;
    }
    let Some(path) = target else {
        commands.remove::<(LightCookie, AuthoredLightCookiePath)>();
        return;
    };
    commands.insert(AuthoredLightCookiePath(path.to_owned()));
    match loader.load(path) {
        Some(image) => commands.insert(LightCookie(image)),
        None => commands.remove::<LightCookie>(),
    };
}
