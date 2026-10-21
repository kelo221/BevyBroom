import { describe, expect, it } from 'vitest';
import { LIGHT_EFFECT_KINDS } from '@/light/model/features/light_settings_effect.js';
import { LIGHT_FOG_SHAPES } from '@/light/model/features/light_settings_fog.js';
import {
  type LightSettings,
  lightSettingsCreateDefault,
  lightSettingsFromUnknown,
  lightSettingsSanitize,
} from '@/light/model/light_settings.js';

/** The effect, cookie, fog, shimmer and baking groups of light settings. */
describe('light settings feature groups', () => {
  it('starts every light without effect, cookie, fog or shimmer and with direct baking', () => {
    for (const kind of ['point', 'spot'] as const) {
      const settings = lightSettingsCreateDefault(kind);
      expect(settings.effectKind).toBe('steady');
      expect(settings.cookieTexture).toBe('');
      expect(settings.fogEnabled).toBe(false);
      expect(settings.shimmer).toBe('none');
      expect(settings.illumination).toBe('direct');
      expect(lightSettingsSanitize(settings)).toEqual(settings);
    }
  });

  it('shapes fog as a forward cone for spots and a sphere for point lights', () => {
    expect(lightSettingsCreateDefault('spot').fogShape).toBe('cone_z');
    expect(lightSettingsCreateDefault('point').fogShape).toBe('sphere');
    expect(LIGHT_FOG_SHAPES).toContain(lightSettingsCreateDefault('spot').fogShape);
  });

  it('replaces unknown choices and clamps numbers into the ranges the game accepts', () => {
    const defaults = lightSettingsCreateDefault('spot');
    const broken = {
      ...defaults,
      effectKind: 'disco',
      fogShape: 'pyramid',
      shimmer: 'sparkle',
      bounceCompression: 'bits3',
      effectPulseModifier: 7,
      fogThickness: 0.2,
      bounceSamples: 1.4,
      bounceColorAlpha: -3,
      cookieTexture: '  textures/gobo.png  ',
    } as unknown as LightSettings;
    const sanitized = lightSettingsSanitize(broken);
    expect(sanitized.effectKind).toBe(defaults.effectKind);
    expect(sanitized.fogShape).toBe(defaults.fogShape);
    expect(sanitized.shimmer).toBe(defaults.shimmer);
    expect(sanitized.bounceCompression).toBe(defaults.bounceCompression);
    expect(sanitized.effectPulseModifier).toBe(1);
    expect(sanitized.fogThickness).toBe(1);
    expect(Number.isInteger(sanitized.bounceSamples) && sanitized.bounceSamples >= 2).toBe(true);
    expect(sanitized.bounceColorAlpha).toBe(0);
    expect(sanitized.cookieTexture).toBe('textures/gobo.png');
  });

  it('keeps every effect kind the game knows', () => {
    for (const effectKind of LIGHT_EFFECT_KINDS) {
      const settings = { ...lightSettingsCreateDefault('point'), effectKind };
      expect(lightSettingsSanitize(settings).effectKind).toBe(effectKind);
    }
  });

  it('reads a scene entry saved before the feature groups existed with their defaults', () => {
    const oldEntry = { kind: 'spot', colorHex: 0x123456, intensity: 4, radius: 6, enabled: true };
    const settings = lightSettingsFromUnknown(oldEntry);
    expect(settings).toEqual({ ...lightSettingsCreateDefault('spot'), colorHex: 0x123456, intensity: 4, radius: 6 });
  });

  it('drops fields lights do not have', () => {
    const settings = lightSettingsFromUnknown({ ...lightSettingsCreateDefault('point'), unknownField: 3 });
    expect(settings && 'unknownField' in settings).toBe(false);
  });
});
