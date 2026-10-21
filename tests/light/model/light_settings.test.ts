import { describe, expect, it } from 'vitest';
import {
  LIGHT_MAX_CUTOFF_DEGREES,
  LIGHT_MIN_RADIUS,
  lightSettingsClone,
  lightSettingsCreateDefault,
  lightSettingsEqual,
  lightSettingsFromUnknown,
  lightSettingsSanitize,
} from '@/light/model/light_settings.js';

/**
 * Light settings are the authored definition shared by the inspector, the scene
 * file and the game preview, so they must stay valid whatever the input.
 */
describe('light settings', () => {
  it('creates valid defaults for both kinds with the spot cone inside its outer angle', () => {
    for (const kind of ['point', 'spot'] as const) {
      const settings = lightSettingsCreateDefault(kind);
      expect(settings.kind).toBe(kind);
      expect(settings.radius).toBeGreaterThanOrEqual(LIGHT_MIN_RADIUS);
      expect(settings.innerCutoffDegrees).toBeLessThanOrEqual(settings.outerCutoffDegrees);
      expect(lightSettingsSanitize(settings)).toEqual(settings);
    }
  });

  it('clones without aliasing the source', () => {
    const source = lightSettingsCreateDefault('spot');
    const copy = lightSettingsClone(source);
    copy.radius = source.radius + 3;
    expect(source.radius).not.toBe(copy.radius);
    expect(lightSettingsEqual(source, lightSettingsClone(source))).toBe(true);
    expect(lightSettingsEqual(source, copy)).toBe(false);
  });

  it('clamps out-of-range values into the renderer limits', () => {
    const settings = lightSettingsCreateDefault('spot');
    const sanitized = lightSettingsSanitize({
      ...settings,
      radius: -4,
      intensity: -1,
      falloff: 7,
      outerCutoffDegrees: LIGHT_MAX_CUTOFF_DEGREES + 50,
      innerCutoffDegrees: LIGHT_MAX_CUTOFF_DEGREES + 80,
      colorHex: 0x1ffffff,
    });
    expect(sanitized.radius).toBe(LIGHT_MIN_RADIUS);
    expect(sanitized.intensity).toBe(0);
    expect(sanitized.falloff).toBeLessThanOrEqual(1);
    expect(sanitized.outerCutoffDegrees).toBe(LIGHT_MAX_CUTOFF_DEGREES);
    expect(sanitized.innerCutoffDegrees).toBeLessThanOrEqual(sanitized.outerCutoffDegrees);
    expect(sanitized.colorHex).toBeLessThanOrEqual(0xffffff);
  });

  it('reads stored JSON back and rejects values that are not settings', () => {
    const stored = JSON.parse(JSON.stringify(lightSettingsCreateDefault('spot')));
    expect(lightSettingsFromUnknown(stored)).toEqual(lightSettingsCreateDefault('spot'));
    expect(lightSettingsFromUnknown(null)).toBeNull();
    expect(lightSettingsFromUnknown('spot')).toBeNull();
  });
});
