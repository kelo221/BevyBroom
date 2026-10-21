import type { LightSettings } from '@/light/model/light_settings.js';

/**
 * Returns the settings with a new light radius and the fog radius changed by
 * the same factor, so the fog keeps its size relative to the light.
 *
 * @param settings Current light settings.
 * @param radius New light radius in meters.
 * @returns Settings with both radii changed; unchanged when the current radius
 *   is not positive.
 */
export function lightSettingsRadiusWrite(settings: LightSettings, radius: number): LightSettings {
  if (!(settings.radius > 0) || !Number.isFinite(radius)) {
    return { ...settings, radius };
  }
  return { ...settings, radius, fogRadius: settings.fogRadius * (radius / settings.radius) };
}
