import type { LightSettings } from '@/light/model/light_settings.js';
import type {
  PreviewAuthoredBounce,
  PreviewAuthoredFog,
  PreviewAuthoredLight,
  PreviewAuthoredLightEffect,
} from '@/preview/protocol/preview_protocol_types.js';
import { previewLightColorChannels } from '@/preview/state/preview_state_light_converter_color.js';

/** The optional feature fields of a wire light. */
type PreviewAuthoredLightFeatures = Pick<
  PreviewAuthoredLight,
  'effect' | 'cookie' | 'fog' | 'shimmer' | 'illumination' | 'transparency' | 'bounce'
>;

/**
 * Converts the effect, cookie, fog, shimmer and baking settings of a light into
 * wire fields. Features that are off are left out.
 *
 * @param settings Editor light settings.
 * @returns Wire feature fields.
 */
export function previewLightFeaturesFromSettings(settings: LightSettings): PreviewAuthoredLightFeatures {
  const features: PreviewAuthoredLightFeatures = {
    shimmer: { kind: settings.shimmer, scale: settings.shimmerScale, modifier: settings.shimmerModifier },
    illumination: settings.illumination,
    transparency: settings.transparency,
    bounce: previewLightBounceFromSettings(settings),
  };
  if (settings.effectKind !== 'steady') {
    features.effect = previewLightEffectFromSettings(settings);
  }
  if (settings.kind === 'spot' && settings.cookieTexture !== '') {
    features.cookie = settings.cookieTexture;
  }
  if (settings.fogEnabled) {
    features.fog = previewLightFogFromSettings(settings);
  }
  return features;
}

/**
 * Converts the effect settings of a light.
 *
 * @param settings Editor light settings.
 * @returns Wire effect.
 */
function previewLightEffectFromSettings(settings: LightSettings): PreviewAuthoredLightEffect {
  return {
    kind: settings.effectKind,
    pulse_speed: settings.effectPulseSpeed,
    pulse_modifier: settings.effectPulseModifier,
    pulse_offset: settings.effectPulseOffset,
    timestep: settings.effectTimestep,
  };
}

/**
 * Converts the fog settings of a light.
 *
 * @param settings Editor light settings.
 * @returns Wire fog.
 */
function previewLightFogFromSettings(settings: LightSettings): PreviewAuthoredFog {
  return {
    shape: settings.fogShape,
    radius: settings.fogRadius,
    thickness: settings.fogThickness,
    intensity: settings.fogIntensity,
    visibility: settings.fogVisibility,
  };
}

/**
 * Converts the bounce settings of a light.
 *
 * @param settings Editor light settings.
 * @returns Wire bounce settings with an sRGB tint and its blend in alpha.
 */
function previewLightBounceFromSettings(settings: LightSettings): PreviewAuthoredBounce {
  return {
    color: [...previewLightColorChannels(settings.bounceColorHex), settings.bounceColorAlpha],
    modifier: settings.bounceModifier,
    intensity: settings.bounceIntensity,
    samples: settings.bounceSamples,
    compression: settings.bounceCompression === 'default' ? null : settings.bounceCompression,
  };
}
