import type { LightSettings } from '@/light/model/light_settings.js';
import type { PreviewAuthoredLight } from '@/preview/protocol/preview_protocol_types.js';
import { previewLightColorChannels } from '@/preview/state/preview_state_light_converter_color.js';
import { previewLightFeaturesFromSettings } from '@/preview/state/preview_state_light_features_converter.js';

/**
 * Converts editor light settings into the game preview light definition.
 *
 * @param settings Editor light settings.
 * @returns Wire light with an sRGB color in 0 to 1 per channel.
 */
export function previewLightFromSettings(settings: LightSettings): PreviewAuthoredLight {
  return {
    light_type: settings.kind,
    color: previewLightColorChannels(settings.colorHex),
    intensity: settings.intensity,
    radius: settings.radius,
    falloff: settings.falloff,
    inner_cutoff: settings.innerCutoffDegrees,
    outer_cutoff: settings.outerCutoffDegrees,
    realtime: settings.realtime,
    shadows: settings.shadows,
    enabled: settings.enabled,
    ...previewLightFeaturesFromSettings(settings),
  };
}
