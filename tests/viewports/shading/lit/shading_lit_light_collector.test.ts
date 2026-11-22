import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { LightOwner } from '@/light/model/light_owner.js';
import { type LightKind, lightSettingsCreateDefault } from '@/light/model/light_settings.js';
import { ShadingLitLightCollector } from '@/viewports/shading/lit/shading_lit_light_collector.js';
import {
  SHADING_LIT_POINT_CONE_COSINE,
  shadingLitCosineFromDegrees,
  shadingLitFalloffPacked,
} from '@/viewports/shading/lit/shading_lit_light_math.js';

/**
 * Creates a light owner with default settings of a kind, changed by the
 * overrides.
 *
 * @param kind Point or spot.
 * @param overrides Settings to change from the defaults.
 * @returns Light owner group.
 */
function lightOwnerCreate(
  kind: LightKind,
  overrides: Partial<ReturnType<typeof lightSettingsCreateDefault>> = {},
): THREE.Group {
  return LightOwner.create(`${kind}_light`, { ...lightSettingsCreateDefault(kind), ...overrides });
}

/**
 * The collector turns authored light owners into the world-space records the
 * Lit shading mode draws, skipping lights that give no light.
 */
describe('ShadingLitLightCollector', () => {
  it('reads world position, linear color and packed falloff of a point light', () => {
    const scene = new THREE.Scene();
    const parent = new THREE.Group();
    const owner = lightOwnerCreate('point', { colorHex: 0x804020, falloff: 0.5 });
    parent.position.set(1, 2, 3);
    owner.position.set(4, 5, 6);
    parent.add(owner);
    scene.add(parent);
    const settings = LightOwner.settingsRead(owner);
    const records = ShadingLitLightCollector.collect(scene);
    const record = records[0];
    expect(records).toHaveLength(1);
    expect(settings).not.toBeNull();
    if (!record || !settings) return;
    const expectedColor = new THREE.Color().setHex(settings.colorHex, THREE.SRGBColorSpace);
    expect(record.position.toArray()).toEqual(parent.position.clone().add(owner.position).toArray());
    expect(record.colorLinear.r).toBeCloseTo(expectedColor.r);
    expect(record.colorLinear.r).toBeLessThan(0x80 / 255);
    expect(record.falloffPacked).toBeCloseTo(shadingLitFalloffPacked(settings.radius, settings.falloff));
    expect(record.innerCosine).toBe(SHADING_LIT_POINT_CONE_COSINE);
  });

  it('points a spot axis back along the owner +Z and converts cutoffs to cosines', () => {
    const scene = new THREE.Scene();
    const owner = lightOwnerCreate('spot', { innerCutoffDegrees: 15, outerCutoffDegrees: 25 });
    owner.rotation.set(-Math.PI / 2, 0, 0);
    scene.add(owner);
    const record = ShadingLitLightCollector.collect(scene)[0];
    expect(record).toBeDefined();
    if (!record) return;
    const expectedAxis = new THREE.Vector3(0, 0, 1).applyEuler(owner.rotation);
    expect(record.axisTowardsLight.distanceTo(expectedAxis)).toBeLessThan(1e-6);
    expect(record.innerCosine).toBeCloseTo(shadingLitCosineFromDegrees(15));
    expect(record.outerCosine).toBeCloseTo(shadingLitCosineFromDegrees(25));
  });

  it('skips disabled, dark and hidden lights', () => {
    const scene = new THREE.Scene();
    const hiddenOwner = lightOwnerCreate('point');
    hiddenOwner.visible = false;
    scene.add(lightOwnerCreate('point', { enabled: false }));
    scene.add(lightOwnerCreate('point', { intensity: 0 }));
    scene.add(hiddenOwner);
    scene.add(lightOwnerCreate('spot'));
    expect(ShadingLitLightCollector.collect(scene)).toHaveLength(1);
  });

  it('keeps the lights whose reach is nearest the viewer when trimming', () => {
    const scene = new THREE.Scene();
    const distances = [40, 10, 30, 20];
    distances.forEach((distance) => {
      const owner = lightOwnerCreate('point', { radius: 2 });
      owner.position.set(distance, 0, 0);
      scene.add(owner);
    });
    const records = ShadingLitLightCollector.collect(scene);
    const nearest = ShadingLitLightCollector.nearest(records, new THREE.Vector3(), 2);
    expect(nearest.map((record) => record.position.x)).toEqual([...distances].sort((a, b) => a - b).slice(0, 2));
    expect(ShadingLitLightCollector.nearest(records, new THREE.Vector3(), 10)).toHaveLength(distances.length);
  });
});
