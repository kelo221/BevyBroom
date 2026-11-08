//! The values an authored light falls back to when the editor leaves a field out. They are
//! DynLight's own defaults, written out so the protocol reads the same with or without the
//! `dynlight` feature; `light_defaults_tests` proves they still match DynLight.

/// `DynamicLight::default().intensity`.
pub(crate) const LIGHT_INTENSITY: f32 = 2.0;
/// `DynamicLight::default().radius`.
pub(crate) const LIGHT_RADIUS: f32 = 4.0;
/// `DynamicLight::default().falloff`.
pub(crate) const LIGHT_FALLOFF: f32 = 0.0;
/// `DynamicLight::default().inner_cutoff`, in degrees.
pub(crate) const LIGHT_INNER_CUTOFF: f32 = 26.0;
/// `DynamicLight::default().outer_cutoff`, in degrees.
pub(crate) const LIGHT_OUTER_CUTOFF: f32 = 30.0;
/// `DynamicLight::default().shimmer_scale`.
pub(crate) const SHIMMER_SCALE: f32 = 12.25;
/// `DynamicLight::default().shimmer_modifier`.
pub(crate) const SHIMMER_MODIFIER: f32 = 0.8;

/// `LightEffect::default().pulse_speed`.
pub(crate) const EFFECT_PULSE_SPEED: f32 = 1.0;
/// `LightEffect::default().pulse_modifier`.
pub(crate) const EFFECT_PULSE_MODIFIER: f32 = 0.25;
/// `LightEffect::default().pulse_offset`.
pub(crate) const EFFECT_PULSE_OFFSET: f32 = 0.0;
/// `LightEffect::default().timestep`, in seconds.
pub(crate) const EFFECT_TIMESTEP: f32 = 1.0 / 30.0;

/// `VolumetricLight::default().radius`.
pub(crate) const FOG_RADIUS: f32 = 4.0;
/// `VolumetricLight::default().thickness`.
pub(crate) const FOG_THICKNESS: f32 = 1.0;
/// `VolumetricLight::default().intensity`.
pub(crate) const FOG_INTENSITY: f32 = 0.75;
/// `VolumetricLight::default().visibility`.
pub(crate) const FOG_VISIBILITY: f32 = 2.0;

/// `LightBounce::default().color` as sRGB `[r, g, b, a]`.
pub(crate) const BOUNCE_COLOR: [f32; 4] = [1.0, 1.0, 1.0, 0.0];
/// `LightBounce::default().modifier`.
pub(crate) const BOUNCE_MODIFIER: f32 = 1.0;
/// `LightBounce::default().intensity`.
pub(crate) const BOUNCE_INTENSITY: f32 = 1.0;
/// `LightBounce::default().samples`.
pub(crate) const BOUNCE_SAMPLES: u32 = 32;
