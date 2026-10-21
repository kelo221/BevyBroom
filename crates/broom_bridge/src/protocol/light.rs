//! Light definitions as the editor authors them, and their DynLight equivalent.

use bevy::prelude::*;
use dynlight::light::{DynamicLight, LightType, ShadowMode};
use serde::{Deserialize, Serialize};

use super::light_features::{
    AuthoredBounce, AuthoredFog, AuthoredIllumination, AuthoredLightEffect, AuthoredShimmer,
    AuthoredTransparency,
};

/// The light shapes the editor can author.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum AuthoredLightType {
    #[default]
    Point,
    /// A cone along the light's local −Z axis.
    Spot,
}

/// How a light casts shadows; mirrors DynLight's `ShadowMode`.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum AuthoredShadowMode {
    /// Shadows of static geometry come from the bake.
    #[default]
    Raytraced,
    /// Baked shadows plus a realtime shadow cubemap for moving casters.
    Realtime,
}

/// One authored light. Units and semantics are DynLight's.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct AuthoredLight {
    pub light_type: AuthoredLightType,
    /// sRGB color, 0 to 1 per channel.
    pub color: [f32; 3],
    pub intensity: f32,
    /// Meters from the light where its light ends.
    pub radius: f32,
    #[serde(default)]
    pub falloff: f32,
    /// Degrees from the spot axis where the light starts to fade.
    #[serde(default = "default_inner_cutoff")]
    pub inner_cutoff: f32,
    /// Degrees from the spot axis where the light ends.
    #[serde(default = "default_outer_cutoff")]
    pub outer_cutoff: f32,
    /// Never baked; evaluated live so it can move freely.
    #[serde(default)]
    pub realtime: bool,
    #[serde(default)]
    pub shadows: AuthoredShadowMode,
    #[serde(default = "enabled_by_default")]
    pub enabled: bool,
    /// Intensity animation; none shines steadily.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub effect: Option<AuthoredLightEffect>,
    /// Spot only: image projected by the light, as a path inside the game's assets folder.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cookie: Option<String>,
    /// Volumetric fog in the light's color; none draws no fog.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fog: Option<AuthoredFog>,
    #[serde(default)]
    pub shimmer: AuthoredShimmer,
    #[serde(default)]
    pub illumination: AuthoredIllumination,
    #[serde(default)]
    pub transparency: AuthoredTransparency,
    #[serde(default)]
    pub bounce: AuthoredBounce,
}

/// Serde default for [`AuthoredLight::inner_cutoff`].
fn default_inner_cutoff() -> f32 {
    DynamicLight::default().inner_cutoff
}

/// Serde default for [`AuthoredLight::outer_cutoff`].
fn default_outer_cutoff() -> f32 {
    DynamicLight::default().outer_cutoff
}

/// Serde default for [`AuthoredLight::enabled`].
fn enabled_by_default() -> bool {
    true
}

impl Default for AuthoredLight {
    fn default() -> Self {
        let light = DynamicLight::default();
        Self {
            light_type: AuthoredLightType::Point,
            color: [1.0, 1.0, 1.0],
            intensity: light.intensity,
            radius: light.radius,
            falloff: light.falloff,
            inner_cutoff: light.inner_cutoff,
            outer_cutoff: light.outer_cutoff,
            realtime: false,
            shadows: AuthoredShadowMode::Raytraced,
            enabled: true,
            effect: None,
            cookie: None,
            fog: None,
            shimmer: AuthoredShimmer::default(),
            illumination: AuthoredIllumination::default(),
            transparency: AuthoredTransparency::default(),
            bounce: AuthoredBounce::default(),
        }
    }
}

impl AuthoredLight {
    /// The largest spot cone, in degrees from the axis.
    pub const MAX_CUTOFF: f32 = 179.0;

    /// Explains the first value DynLight would reject or that makes no sense to author.
    pub fn validate(&self) -> Result<(), String> {
        let numbers = [
            self.intensity,
            self.radius,
            self.falloff,
            self.inner_cutoff,
            self.outer_cutoff,
        ];
        if !numbers
            .iter()
            .chain(&self.color)
            .all(|value| value.is_finite())
        {
            return Err("a value is not a finite number".into());
        }
        if self.radius <= 0.0 {
            return Err(format!("radius {} must be above zero", self.radius));
        }
        if self.intensity < 0.0 {
            return Err(format!("intensity {} must not be negative", self.intensity));
        }
        self.validate_features()?;
        if self.light_type == AuthoredLightType::Spot {
            return self.validate_cone();
        }
        Ok(())
    }

    /// Explains the first invalid value of the effect, fog, shimmer or bounce.
    fn validate_features(&self) -> Result<(), String> {
        if let Some(effect) = &self.effect {
            effect.validate()?;
        }
        if let Some(fog) = &self.fog {
            fog.validate()?;
        }
        if !self.shimmer.scale.is_finite() || !self.shimmer.modifier.is_finite() {
            return Err("a shimmer value is not a finite number".into());
        }
        self.bounce.validate()
    }

    /// Spot cones need `0 < outer <= MAX_CUTOFF` and `0 <= inner <= outer`.
    fn validate_cone(&self) -> Result<(), String> {
        if self.outer_cutoff <= 0.0 || self.outer_cutoff > Self::MAX_CUTOFF {
            return Err(format!(
                "outer cutoff {}° must be above 0° and at most {}°",
                self.outer_cutoff,
                Self::MAX_CUTOFF
            ));
        }
        if self.inner_cutoff < 0.0 || self.inner_cutoff > self.outer_cutoff {
            return Err(format!(
                "inner cutoff {}° must be between 0° and the outer cutoff {}°",
                self.inner_cutoff, self.outer_cutoff
            ));
        }
        Ok(())
    }

    /// The DynLight component for this definition.
    pub fn to_dynamic_light(&self) -> DynamicLight {
        DynamicLight {
            color: Color::srgb(self.color[0], self.color[1], self.color[2]),
            intensity: self.intensity,
            radius: self.radius,
            falloff: self.falloff,
            realtime: self.realtime,
            light_type: match self.light_type {
                AuthoredLightType::Point => LightType::Point,
                AuthoredLightType::Spot => LightType::Spot,
            },
            inner_cutoff: self.inner_cutoff,
            outer_cutoff: self.outer_cutoff,
            shadows: match self.shadows {
                AuthoredShadowMode::Raytraced => ShadowMode::Raytraced,
                AuthoredShadowMode::Realtime => ShadowMode::Realtime,
            },
            illumination: self.illumination.to_dynlight(),
            transparency: self.transparency.to_dynlight(),
            bounce: self.bounce.to_dynlight(),
            shimmer: self.shimmer.to_dynlight(),
            shimmer_scale: self.shimmer.scale,
            shimmer_modifier: self.shimmer.modifier,
            ..default()
        }
    }

    /// The part of `self` a bake depends on: everything except what DynLight evaluates live,
    /// which is color, intensity, effect, cookie, fog, shimmer and the bounce light's runtime
    /// visibility. Those are reset to fixed values.
    pub fn bake_relevant(&self) -> Self {
        Self {
            color: [0.0; 3],
            intensity: 0.0,
            effect: None,
            cookie: None,
            fog: None,
            shimmer: AuthoredShimmer::default(),
            bounce: AuthoredBounce {
                modifier: 0.0,
                ..self.bounce
            },
            ..self.clone()
        }
    }

    /// Whether changing from `self` to `other` changes what a bake would contain.
    pub fn bake_relevant_change(&self, other: &Self) -> bool {
        self.bake_relevant() != other.bake_relevant()
    }
}
