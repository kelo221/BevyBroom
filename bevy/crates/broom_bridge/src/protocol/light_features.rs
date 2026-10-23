//! The optional DynLight features of an authored light: intensity effects, volumetric fog,
//! shimmer and baking options, and their DynLight equivalents.

use bevy::prelude::*;
use dynlight::effects::{LightEffect, LightEffectKind};
use dynlight::fog::{VolumetricLight, VolumetricShape};
use dynlight::light::{
    BounceCompression, DynamicLight, Illumination, LightBounce, Shimmer, Transparency,
};
use serde::{Deserialize, Serialize};

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

impl AuthoredEffectKind {
    /// The DynLight effect kind.
    pub fn to_dynlight(self) -> LightEffectKind {
        use AuthoredEffectKind as Kind;
        match self {
            Kind::Steady => LightEffectKind::Steady,
            Kind::Pulse => LightEffectKind::Pulse,
            Kind::Random => LightEffectKind::Random,
            Kind::Strobe => LightEffectKind::Strobe,
            Kind::Flicker => LightEffectKind::Flicker,
            Kind::FluorescentStarter => LightEffectKind::FluorescentStarter,
            Kind::FluorescentClicker => LightEffectKind::FluorescentClicker,
            Kind::FluorescentRandom => LightEffectKind::FluorescentRandom,
            Kind::Candle => LightEffectKind::Candle,
            Kind::Pulsar => LightEffectKind::Pulsar,
            Kind::Fire => LightEffectKind::Fire,
            Kind::Generator => LightEffectKind::Generator,
            Kind::Lightning => LightEffectKind::Lightning,
            Kind::Cloudy => LightEffectKind::Cloudy,
            Kind::Overcast => LightEffectKind::Overcast,
        }
    }
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
        let effect = LightEffect::default();
        Self {
            kind: AuthoredEffectKind::Steady,
            pulse_speed: effect.pulse_speed,
            pulse_modifier: effect.pulse_modifier,
            pulse_offset: effect.pulse_offset,
            timestep: effect.timestep,
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

    /// The DynLight component.
    pub fn to_dynlight(&self) -> LightEffect {
        LightEffect {
            kind: self.kind.to_dynlight(),
            pulse_speed: self.pulse_speed,
            pulse_modifier: self.pulse_modifier,
            pulse_offset: self.pulse_offset,
            timestep: self.timestep,
        }
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
        let fog = VolumetricLight::default();
        Self {
            shape: AuthoredFogShape::Sphere,
            radius: fog.radius,
            thickness: fog.thickness,
            intensity: fog.intensity,
            visibility: fog.visibility,
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

    /// The DynLight component.
    pub fn to_dynlight(&self) -> VolumetricLight {
        VolumetricLight {
            shape: match self.shape {
                AuthoredFogShape::Sphere => VolumetricShape::Sphere,
                AuthoredFogShape::Box => VolumetricShape::Box,
                AuthoredFogShape::ConeZ => VolumetricShape::ConeZ,
                AuthoredFogShape::ConeY => VolumetricShape::ConeY,
                AuthoredFogShape::Frustum => VolumetricShape::Frustum,
            },
            radius: self.radius,
            thickness: self.thickness,
            intensity: self.intensity.clamp(0.0, 1.0),
            visibility: self.visibility.max(0.0),
        }
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
        let light = DynamicLight::default();
        Self {
            kind: AuthoredShimmerKind::None,
            scale: light.shimmer_scale,
            modifier: light.shimmer_modifier,
        }
    }
}

impl AuthoredShimmer {
    /// The DynLight shimmer pattern.
    pub fn to_dynlight(&self) -> Shimmer {
        match self.kind {
            AuthoredShimmerKind::None => Shimmer::None,
            AuthoredShimmerKind::Water => Shimmer::Water,
            AuthoredShimmerKind::Random => Shimmer::Random,
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

impl AuthoredIllumination {
    /// The DynLight illumination mode.
    pub fn to_dynlight(self) -> Illumination {
        match self {
            Self::Direct => Illumination::Direct,
            Self::SingleBounce => Illumination::SingleBounce,
        }
    }
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

impl AuthoredTransparency {
    /// The DynLight transparency mode.
    pub fn to_dynlight(self) -> Transparency {
        match self {
            Self::Disabled => Transparency::Disabled,
            Self::Enabled => Transparency::Enabled,
            Self::EnabledMax => Transparency::EnabledMax,
        }
    }
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
        let bounce = LightBounce::default();
        Self {
            color: bounce.color.to_srgba().to_f32_array(),
            modifier: bounce.modifier,
            intensity: bounce.intensity,
            samples: bounce.samples,
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

    /// The DynLight bounce settings.
    pub fn to_dynlight(&self) -> LightBounce {
        let [red, green, blue, alpha] = self.color;
        LightBounce {
            color: Color::srgba(red, green, blue, alpha),
            modifier: self.modifier,
            intensity: self.intensity,
            samples: self.samples,
            compression: self.compression.map(|compression| match compression {
                AuthoredBounceCompression::Bits8 => BounceCompression::Bits8,
                AuthoredBounceCompression::Bits6 => BounceCompression::Bits6,
                AuthoredBounceCompression::Bits5 => BounceCompression::Bits5,
                AuthoredBounceCompression::Bits4 => BounceCompression::Bits4,
            }),
        }
    }
}
