//! The optional DynLight features of an authored light: intensity effects, volumetric fog,
//! shimmer and baking options. Their DynLight equivalents are in `light_dynlight`.

use serde::{Deserialize, Serialize};

use super::light_defaults::{
    BOUNCE_COLOR, BOUNCE_INTENSITY, BOUNCE_MODIFIER, BOUNCE_SAMPLES, EFFECT_PULSE_MODIFIER,
    EFFECT_PULSE_OFFSET, EFFECT_PULSE_SPEED, EFFECT_TIMESTEP, FOG_INTENSITY, FOG_RADIUS,
    FOG_THICKNESS, FOG_VISIBILITY, SHIMMER_MODIFIER, SHIMMER_SCALE,
};

/// The intensity animations DynLight plays; mirrors `LightEffectKind`.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum AuthoredEffectKind {
    #[default]
    Steady,
    Pulse,
    Random,
    Strobe,
    Flicker,
    FluorescentStarter,
    FluorescentClicker,
    FluorescentRandom,
    Candle,
    Pulsar,
    Fire,
    Generator,
    Lightning,
    Cloudy,
    Overcast,
}

/// An intensity animation; becomes a `LightEffect` next to the light.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq)]
#[serde(default)]
pub struct AuthoredLightEffect {
    pub kind: AuthoredEffectKind,
    pub pulse_speed: f32,
    pub pulse_modifier: f32,
    pub pulse_offset: f32,
    pub timestep: f32,
}

impl Default for AuthoredLightEffect {
    fn default() -> Self {
        Self {
            kind: AuthoredEffectKind::Steady,
            pulse_speed: EFFECT_PULSE_SPEED,
            pulse_modifier: EFFECT_PULSE_MODIFIER,
            pulse_offset: EFFECT_PULSE_OFFSET,
            timestep: EFFECT_TIMESTEP,
        }
    }
}

impl AuthoredLightEffect {
    /// Explains the first value DynLight would reject.
    pub fn validate(&self) -> Result<(), String> {
        let numbers = [
            self.pulse_speed,
            self.pulse_modifier,
            self.pulse_offset,
            self.timestep,
        ];
        if !numbers.iter().all(|value| value.is_finite()) {
            return Err("an effect value is not a finite number".into());
        }
        if self.timestep <= 0.0 {
            return Err(format!("effect step {} must be above zero", self.timestep));
        }
        Ok(())
    }
}

/// The shape of a fog volume; mirrors `VolumetricShape`.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum AuthoredFogShape {
    #[default]
    Sphere,
    Box,
    ConeZ,
    ConeY,
    Frustum,
}

/// Volumetric fog in the light's color; becomes a `VolumetricLight` next to the light.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq)]
#[serde(default)]
pub struct AuthoredFog {
    pub shape: AuthoredFogShape,
    pub radius: f32,
    pub thickness: f32,
    pub intensity: f32,
    pub visibility: f32,
}

impl Default for AuthoredFog {
    fn default() -> Self {
        Self {
            shape: AuthoredFogShape::Sphere,
            radius: FOG_RADIUS,
            thickness: FOG_THICKNESS,
            intensity: FOG_INTENSITY,
            visibility: FOG_VISIBILITY,
        }
    }
}

impl AuthoredFog {
    /// Explains the first value DynLight would reject.
    pub fn validate(&self) -> Result<(), String> {
        let numbers = [self.radius, self.thickness, self.intensity, self.visibility];
        if !numbers.iter().all(|value| value.is_finite()) {
            return Err("a fog value is not a finite number".into());
        }
        if self.radius <= 0.0 {
            return Err(format!("fog radius {} must be above zero", self.radius));
        }
        if self.thickness < 1.0 {
            return Err(format!(
                "fog thickness {} must be at least 1",
                self.thickness
            ));
        }
        Ok(())
    }
}

/// A pattern projected onto lit surfaces; mirrors `Shimmer`.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum AuthoredShimmerKind {
    #[default]
    None,
    Water,
    Random,
}

/// The shimmer pattern of a light and its block scale and dimming.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq)]
#[serde(default)]
pub struct AuthoredShimmer {
    pub kind: AuthoredShimmerKind,
    pub scale: f32,
    pub modifier: f32,
}

impl Default for AuthoredShimmer {
    fn default() -> Self {
        Self {
            kind: AuthoredShimmerKind::None,
            scale: SHIMMER_SCALE,
            modifier: SHIMMER_MODIFIER,
        }
    }
}

/// Whether the bake adds one bounce of indirect light; mirrors `Illumination`.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum AuthoredIllumination {
    #[default]
    Direct,
    SingleBounce,
}

/// Whether baked shadows pass through alpha-tested textures; mirrors `Transparency`.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum AuthoredTransparency {
    #[default]
    Disabled,
    Enabled,
    EnabledMax,
}

/// Storage precision of baked bounce light; mirrors `BounceCompression`.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AuthoredBounceCompression {
    Bits8,
    Bits6,
    Bits5,
    Bits4,
}

/// Baked bounce settings; mirrors `LightBounce`.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq)]
#[serde(default)]
pub struct AuthoredBounce {
    /// sRGB tint and its blend from the light's own color (alpha 0) to the tint (alpha 1).
    pub color: [f32; 4],
    /// Visibility at runtime; the only bounce value that needs no re-bake.
    pub modifier: f32,
    pub intensity: f32,
    pub samples: u32,
    /// `None` lets the bake choose.
    pub compression: Option<AuthoredBounceCompression>,
}

impl Default for AuthoredBounce {
    fn default() -> Self {
        Self {
            color: BOUNCE_COLOR,
            modifier: BOUNCE_MODIFIER,
            intensity: BOUNCE_INTENSITY,
            samples: BOUNCE_SAMPLES,
            compression: None,
        }
    }
}

impl AuthoredBounce {
    /// Explains the first value DynLight would reject.
    pub fn validate(&self) -> Result<(), String> {
        let numbers = [self.modifier, self.intensity];
        if !numbers
            .iter()
            .chain(&self.color)
            .all(|value| value.is_finite())
        {
            return Err("a bounce value is not a finite number".into());
        }
        if self.samples < 2 {
            return Err(format!(
                "bounce samples {} must be at least 2",
                self.samples
            ));
        }
        Ok(())
    }
}
