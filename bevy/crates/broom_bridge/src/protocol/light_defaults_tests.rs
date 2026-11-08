//! The written-out light defaults still are DynLight's own defaults.

use dynlight::effects::LightEffect;
use dynlight::fog::VolumetricLight;
use dynlight::light::{DynamicLight, LightBounce};

use super::*;

/// Every field matches; the color only in value, as DynLight stores its white in linear space.
#[test]
fn a_default_authored_light_is_a_default_dynamic_light() {
    let converted = AuthoredLight::default().to_dynamic_light();
    let defaults = DynamicLight::default();
    assert_eq!(converted.color.to_linear(), defaults.color.to_linear());
    assert_eq!(
        DynamicLight {
            color: defaults.color,
            ..converted
        },
        defaults
    );
}

#[test]
fn default_light_features_are_dynlights_default_components() {
    assert_eq!(
        AuthoredLightEffect::default().to_dynlight(),
        LightEffect::default()
    );
    assert_eq!(
        AuthoredFog::default().to_dynlight(),
        VolumetricLight::default()
    );
    assert_eq!(
        AuthoredBounce::default().to_dynlight(),
        LightBounce::default()
    );
}

#[test]
fn a_light_with_every_field_left_out_reads_dynlights_defaults() {
    let json = r#"{ "light_type": "spot", "color": [1, 1, 1], "intensity": 2, "radius": 4 }"#;
    let light: AuthoredLight = serde_json::from_str(json).expect("the light parses");
    let defaults = DynamicLight::default();
    let dynamic = light.to_dynamic_light();
    assert_eq!(dynamic.inner_cutoff, defaults.inner_cutoff);
    assert_eq!(dynamic.outer_cutoff, defaults.outer_cutoff);
    assert_eq!(dynamic.shimmer_scale, defaults.shimmer_scale);
    assert_eq!(dynamic.shimmer_modifier, defaults.shimmer_modifier);
}
