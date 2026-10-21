//! The effect, cookie, fog, shimmer and baking fields of authored lights.

use bevy::prelude::*;
use dynlight::effects::LightEffectKind;
use dynlight::fog::VolumetricShape;
use dynlight::light::{BounceCompression, Illumination, Shimmer, Transparency};

use super::*;
use crate::test_support::sample_state;

/// The sample's spot light, which uses every feature.
fn sample_spot() -> AuthoredLight {
    sample_state()
        .objects
        .into_iter()
        .find(|object| object.id == "light-spot")
        .and_then(|object| object.light)
        .expect("the sample has a spot light")
}

#[test]
fn sample_spot_light_parses_every_feature() {
    let spot = sample_spot();
    let effect = spot.effect.expect("the spot has an effect");
    assert_eq!(effect.kind, AuthoredEffectKind::Flicker);
    assert_eq!(spot.cookie.as_deref(), Some("textures/gobo.png"));
    let fog = spot.fog.expect("the spot has fog");
    assert_eq!(fog.shape, AuthoredFogShape::ConeZ);
    assert_eq!(spot.shimmer.kind, AuthoredShimmerKind::Water);
    assert_eq!(spot.illumination, AuthoredIllumination::SingleBounce);
    assert_eq!(spot.transparency, AuthoredTransparency::Enabled);
    assert_eq!(
        spot.bounce.compression,
        Some(AuthoredBounceCompression::Bits6)
    );
    assert_eq!(spot.validate(), Ok(()));
}

#[test]
fn lights_without_features_get_dynlight_defaults() {
    let json = r#"{ "light_type": "point", "color": [1, 1, 1], "intensity": 1, "radius": 4 }"#;
    let light: AuthoredLight = serde_json::from_str(json).expect("parses");
    assert_eq!(light.effect, None);
    assert_eq!(light.fog, None);
    let dynamic = light.to_dynamic_light();
    let defaults = dynlight::light::DynamicLight::default();
    assert_eq!(dynamic.shimmer, defaults.shimmer);
    assert_eq!(dynamic.shimmer_scale, defaults.shimmer_scale);
    assert_eq!(dynamic.bounce, defaults.bounce);
    assert_eq!(dynamic.illumination, defaults.illumination);
}

#[test]
fn features_become_dynlight_settings_and_components() {
    let spot = sample_spot();
    let light = spot.to_dynamic_light();
    assert_eq!(light.shimmer, Shimmer::Water);
    assert_eq!(light.shimmer_scale, spot.shimmer.scale);
    assert_eq!(light.illumination, Illumination::SingleBounce);
    assert_eq!(light.transparency, Transparency::Enabled);
    assert_eq!(light.bounce.samples, spot.bounce.samples);
    assert_eq!(light.bounce.compression, Some(BounceCompression::Bits6));
    let [red, green, blue, alpha] = spot.bounce.color;
    assert_eq!(light.bounce.color, Color::srgba(red, green, blue, alpha));
    let effect = spot.effect.expect("effect").to_dynlight();
    assert_eq!(effect.kind, LightEffectKind::Flicker);
    let fog = spot.fog.expect("fog").to_dynlight();
    assert_eq!(fog.shape, VolumetricShape::ConeZ);
    assert_eq!(fog.radius, 6.0);
}

#[test]
fn live_features_do_not_change_a_bake_but_baking_options_do() {
    let light = AuthoredLight::default();
    let live = AuthoredLight {
        effect: Some(AuthoredLightEffect {
            kind: AuthoredEffectKind::Candle,
            ..default()
        }),
        cookie: Some("textures/gobo.png".into()),
        fog: Some(AuthoredFog::default()),
        shimmer: AuthoredShimmer {
            kind: AuthoredShimmerKind::Random,
            ..default()
        },
        bounce: AuthoredBounce {
            modifier: 0.2,
            ..default()
        },
        ..light.clone()
    };
    assert!(!light.bake_relevant_change(&live));
    let bounced = AuthoredLight {
        illumination: AuthoredIllumination::SingleBounce,
        ..light.clone()
    };
    assert!(light.bake_relevant_change(&bounced));
    let stronger_bounce = AuthoredLight {
        bounce: AuthoredBounce {
            intensity: 3.0,
            ..default()
        },
        ..light.clone()
    };
    assert!(light.bake_relevant_change(&stronger_bounce));
}

#[test]
fn invalid_feature_values_are_rejected() {
    let foggy = |fog: AuthoredFog| AuthoredLight {
        fog: Some(fog),
        ..default()
    };
    let no_radius = AuthoredFog {
        radius: 0.0,
        ..default()
    };
    assert!(foggy(no_radius).validate().is_err());
    let thin = AuthoredFog {
        thickness: 0.5,
        ..default()
    };
    assert!(foggy(thin).validate().is_err());
    let stuck_effect = AuthoredLight {
        effect: Some(AuthoredLightEffect {
            timestep: 0.0,
            ..default()
        }),
        ..default()
    };
    assert!(stuck_effect.validate().is_err());
    let few_samples = AuthoredLight {
        bounce: AuthoredBounce {
            samples: 1,
            ..default()
        },
        ..default()
    };
    assert!(few_samples.validate().is_err());
}
