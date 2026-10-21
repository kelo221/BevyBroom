import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { LightOwner } from '@/light/model/light_owner.js';
import { type LightSettings, lightSettingsCreateDefault } from '@/light/model/light_settings.js';
import { LIGHT_FOG_SHAPES } from '@/light/model/features/light_settings_fog.js';
import { LightVisualFog } from '@/light/visual/light_visual_fog.js';

/**
 * Returns the endpoints of a named guide of a light owner.
 *
 * @param owner Light owner.
 * @param name Guide object name.
 * @returns Endpoints in owner space, or null when the guide is missing.
 */
function guidePointsRead(owner: THREE.Object3D, name: string): THREE.Vector3[] | null {
  const guide = owner.children.find((child) => child.name === name);
  if (!(guide instanceof THREE.LineSegments)) {
    return null;
  }
  const position = guide.geometry.getAttribute('position');
  const points: THREE.Vector3[] = [];
  for (let index = 0; index < position.count; index++) {
    points.push(new THREE.Vector3().fromBufferAttribute(position, index));
  }
  return points;
}

/**
 * Returns the largest angle between the −Z axis and any cone guide point.
 *
 * @param points Cone guide endpoints.
 * @returns Angle in degrees.
 */
function coneWidestAngleDegrees(points: readonly THREE.Vector3[]): number {
  const forward = new THREE.Vector3(0, 0, -1);
  const angles = points.filter((point) => point.lengthSq() > 1e-9).map((point) => point.angleTo(forward));
  return THREE.MathUtils.radToDeg(Math.max(...angles));
}

/** Light guides: the spot cone at any angle and the fog volume outline. */
describe('LightVisualBuilder', () => {
  it('draws the spot cone rim on the range sphere at the outer angle, wide cones included', () => {
    for (const outerCutoffDegrees of [30, 90, 150]) {
      const settings: LightSettings = {
        ...lightSettingsCreateDefault('spot'),
        outerCutoffDegrees,
        innerCutoffDegrees: 10,
      };
      const points = guidePointsRead(LightOwner.create('Spot', settings), 'Light Cone') ?? [];
      expect(points.length).toBeGreaterThan(0);
      expect(coneWidestAngleDegrees(points)).toBeCloseTo(outerCutoffDegrees, 3);
      const farthest = Math.max(...points.map((point) => point.length()));
      expect(farthest).toBeCloseTo(settings.radius, 5);
    }
  });

  it('draws a fog outline only while fog is enabled', () => {
    const settings = lightSettingsCreateDefault('point');
    expect(guidePointsRead(LightOwner.create('Lamp', settings), 'Light Fog')).toBeNull();
    const foggy = LightOwner.create('Lamp', { ...settings, fogEnabled: true });
    expect(guidePointsRead(foggy, 'Light Fog')?.length).toBeGreaterThan(0);
  });

  it('sizes every fog shape by the fog radius', () => {
    for (const fogShape of LIGHT_FOG_SHAPES) {
      const settings: LightSettings = {
        ...lightSettingsCreateDefault('spot'),
        fogEnabled: true,
        fogShape,
        fogRadius: 3,
      };
      const points = LightVisualFog.outlinePoints(settings);
      const reach = (axis: 'x' | 'y' | 'z'): number => Math.max(...points.map((point) => Math.abs(point[axis])));
      expect(Math.max(reach('x'), reach('y'), reach('z')), fogShape).toBeGreaterThanOrEqual(settings.fogRadius - 1e-6);
    }
  });

  it('points a forward cone along −Z and an up cone along +Y', () => {
    const base: LightSettings = { ...lightSettingsCreateDefault('spot'), fogEnabled: true, fogRadius: 2 };
    const forward = LightVisualFog.outlinePoints({ ...base, fogShape: 'cone_z' });
    const up = LightVisualFog.outlinePoints({ ...base, fogShape: 'cone_y' });
    expect(Math.min(...forward.map((point) => point.z))).toBeCloseTo(-base.fogRadius, 5);
    expect(Math.max(...up.map((point) => point.y))).toBeCloseTo(base.fogRadius, 5);
  });
});
