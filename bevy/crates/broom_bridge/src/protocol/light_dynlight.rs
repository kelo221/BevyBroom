//! The DynLight equivalents of authored lights, their features, rooms and portals. Only built
//! with the `dynlight` feature.

use bevy::prelude::*;
use dynlight::effects::{LightEffect, LightEffectKind};
use dynlight::fog::{VolumetricLight, VolumetricShape};
use dynlight::light::{
    BounceCompression, DynamicLight, Illumination, LightBounce, LightType, ShadowMode, Shimmer,
    Transparency,
};
use dynlight::portals::{Portal, Room};

use super::light::{AuthoredLight, AuthoredLightType, AuthoredShadowMode};
use super::light_features::{
    AuthoredBounce, AuthoredBounceCompression, AuthoredEffectKind, AuthoredFog, AuthoredFogShape,
    AuthoredIllumination, AuthoredLightEffect, AuthoredShimmer, AuthoredShimmerKind,
    AuthoredTransparency,
};
use super::portal::{AuthoredPortal, AuthoredRoom};

impl AuthoredLight {
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

impl AuthoredLightEffect {
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

impl AuthoredFog {
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

impl AuthoredIllumination {
    /// The DynLight illumination mode.
    pub fn to_dynlight(self) -> Illumination {
        match self {
            Self::Direct => Illumination::Direct,
            Self::SingleBounce => Illumination::SingleBounce,
        }
    }
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

impl AuthoredBounce {
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

impl AuthoredRoom {
    /// The DynLight component for this definition.
    pub fn to_room(&self) -> Room {
        Room {
            half_size: Vec3::from_array(self.half_size),
        }
    }
}

impl AuthoredPortal {
    /// The DynLight component for this definition, linked automatically on both sides.
    pub fn to_portal(&self) -> Portal {
        Portal::new(Vec2::from_array(self.size))
    }
}
