//! Light definitions as the editor authors them, and their DynLight equivalent.

use bevy::prelude::*;
use dynlight::light::{DynamicLight, LightType, ShadowMode};
use serde::{Deserialize, Serialize};

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
        if self.light_type == AuthoredLightType::Spot {
            return self.validate_cone();
        }
        Ok(())
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
            ..default()
        }
    }

    /// Whether changing from `self` to `other` changes what a bake would contain: everything
    /// except color and intensity, which DynLight evaluates live.
    pub fn bake_relevant_change(&self, other: &Self) -> bool {
        let live_only = |light: &Self| Self {
            color: [0.0; 3],
            intensity: 0.0,
            ..light.clone()
        };
        live_only(self) != live_only(other)
    }
}
