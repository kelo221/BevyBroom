import type { LightSettings } from '@/light/model/light_settings.js';
import type { PreviewAuthoredLight } from '@/preview/protocol/preview_protocol_types.js';

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
  };
}

/**
 * Splits a 0xRRGGBB color into sRGB channels from 0 to 1.
 *
 * @param colorHex Color number.
 * @returns Red, green and blue channels.
 */
export function previewLightColorChannels(colorHex: number): [number, number, number] {
  const red = (colorHex >> 16) & 0xff;
  const green = (colorHex >> 8) & 0xff;
  const blue = colorHex & 0xff;
  return [red / 255, green / 255, blue / 255];
}
