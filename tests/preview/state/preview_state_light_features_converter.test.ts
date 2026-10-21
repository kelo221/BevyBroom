import { describe, expect, it } from 'vitest';
import { type LightSettings, lightSettingsCreateDefault } from '@/light/model/light_settings.js';
import { previewLightFromSettings } from '@/preview/state/preview_state_light_converter.js';
import { previewLightColorChannels } from '@/preview/state/preview_state_light_converter_color.js';

/**
 * Returns spot light settings with every feature turned on.
 *
 * @returns Settings with an effect, cookie, fog, shimmer and bounce.
 */
function spotWithEveryFeature(): LightSettings {
  return {
    ...lightSettingsCreateDefault('spot'),
    effectKind: 'flicker',
    effectPulseSpeed: 2,
    effectPulseModifier: 0.4,
    effectPulseOffset: 0.5,
    effectTimestep: 0.1,
    cookieTexture: 'textures/gobo.png',
    fogEnabled: true,
    fogShape: 'cone_z',
    fogRadius: 5,
    fogThickness: 2,
    fogIntensity: 0.5,
    fogVisibility: 3,
    shimmer: 'water',
    shimmerScale: 10,
    shimmerModifier: 0.6,
    illumination: 'single_bounce',
    transparency: 'enabled',
    bounceColorHex: 0xff8000,
    bounceColorAlpha: 0.5,
    bounceModifier: 0.7,
    bounceIntensity: 2,
    bounceSamples: 64,
    bounceCompression: 'bits6',
  };
}

/** The wire light carries the effect, cookie, fog, shimmer and baking settings. */
describe('previewLightFromSettings features', () => {
  it('maps every feature field of a spot light', () => {
    const settings = spotWithEveryFeature();
    const light = previewLightFromSettings(settings);
    expect(light.effect).toEqual({
      kind: 'flicker',
      pulse_speed: 2,
      pulse_modifier: 0.4,
      pulse_offset: 0.5,
      timestep: 0.1,
    });
    expect(light.cookie).toBe(settings.cookieTexture);
    expect(light.fog).toEqual({ shape: 'cone_z', radius: 5, thickness: 2, intensity: 0.5, visibility: 3 });
    expect(light.shimmer).toEqual({ kind: 'water', scale: 10, modifier: 0.6 });
    expect(light.illumination).toBe('single_bounce');
    expect(light.transparency).toBe('enabled');
    expect(light.bounce).toEqual({
      color: [...previewLightColorChannels(settings.bounceColorHex), 0.5],
      modifier: 0.7,
      intensity: 2,
      samples: 64,
      compression: 'bits6',
    });
  });

  it('leaves out an effect, cookie and fog that are off', () => {
    const light = previewLightFromSettings(lightSettingsCreateDefault('spot'));
    expect('effect' in light).toBe(false);
    expect('cookie' in light).toBe(false);
    expect('fog' in light).toBe(false);
    expect(light.bounce.compression).toBeNull();
  });

  it('leaves out the cookie of a point light', () => {
    const light = previewLightFromSettings({ ...spotWithEveryFeature(), kind: 'point' });
    expect('cookie' in light).toBe(false);
  });
});
