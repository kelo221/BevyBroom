import { describe, expect, it } from 'vitest';
import { lightSettingsRadiusWrite } from '@/light/model/features/light_settings_radius.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { lightSettingsCreateDefault } from '@/light/model/light_settings.js';

/** Unit tests for the fog radius following the light radius. */
describe('lightSettingsRadiusWrite', () => {
  it('changes the fog radius by the same factor as the light radius', () => {
    const settings = lightSettingsCreateDefault('spot');
    const factor = 2.5;
    const written = lightSettingsRadiusWrite(settings, settings.radius * factor);
    expect(written.radius).toBeCloseTo(settings.radius * factor);
    expect(written.fogRadius).toBeCloseTo(settings.fogRadius * factor);
    expect(written.outerCutoffDegrees).toBe(settings.outerCutoffDegrees);
  });

  it('scales the fog radius when a light absorbs a scale', () => {
    const settings = lightSettingsCreateDefault('point');
    const factor = 0.5;
    const absorbed = LightOwner.definition.scaleAbsorb(settings, factor);
    expect(absorbed.radius).toBeCloseTo(settings.radius * factor);
    expect(absorbed.fogRadius).toBeCloseTo(settings.fogRadius * factor);
  });

  it('scales the fog radius for a radius-only patch and keeps an explicit fog radius', () => {
    const settings = lightSettingsCreateDefault('spot');
    const radiusOnly = LightOwner.definition.settingsPatch(settings, { radius: settings.radius * 2 });
    expect(radiusOnly['fogRadius']).toBeCloseTo(settings.fogRadius * 2);
    const explicitFog = settings.fogRadius + 1;
    const both = LightOwner.definition.settingsPatch(settings, { radius: settings.radius * 2, fogRadius: explicitFog });
    expect(both['fogRadius']).toBe(explicitFog);
    const other = LightOwner.definition.settingsPatch(settings, { intensity: settings.intensity + 1 });
    expect(other['fogRadius']).toBe(settings.fogRadius);
  });
});
