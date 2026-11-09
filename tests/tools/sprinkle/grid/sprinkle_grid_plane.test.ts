import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SprinkleGridPlane, type SprinkleGridAxis } from '@/tools/sprinkle/grid/sprinkle_grid_plane.js';

/** Every world axis with its unit vector. */
const SPRINKLE_GRID_PLANE_TEST_AXES: ReadonlyArray<{ axis: SprinkleGridAxis; unit: THREE.Vector3 }> = [
  { axis: 'x', unit: new THREE.Vector3(1, 0, 0) },
  { axis: 'y', unit: new THREE.Vector3(0, 1, 0) },
  { axis: 'z', unit: new THREE.Vector3(0, 0, 1) },
];

/**
 * The Sprinkle grid plane is the world axis plane most facing a surface normal,
 * with fixed U and V axes so strokes on the same surface share cells.
 */
describe('SprinkleGridPlane', () => {
  it('picks the dominant axis of tilted normals on both sides', () => {
    for (const { axis, unit } of SPRINKLE_GRID_PLANE_TEST_AXES) {
      const tilted = unit
        .clone()
        .multiplyScalar(2)
        .add(new THREE.Vector3(0.3, 0.3, 0.3))
        .normalize();
      expect(SprinkleGridPlane.fromNormal(tilted).normalAxis).toBe(axis);
      expect(SprinkleGridPlane.fromNormal(tilted.clone().negate()).normalAxis).toBe(axis);
    }
  });

  it('prefers the floor plane when the normal leans equally', () => {
    expect(SprinkleGridPlane.fromNormal(new THREE.Vector3(1, 1, 1).normalize()).normalAxis).toBe('y');
  });

  it('uses X/Z on floors, Z/Y on walls facing X and X/Y on walls facing Z', () => {
    expect([new SprinkleGridPlane('y').uAxis, new SprinkleGridPlane('y').vAxis]).toEqual(['x', 'z']);
    expect([new SprinkleGridPlane('x').uAxis, new SprinkleGridPlane('x').vAxis]).toEqual(['z', 'y']);
    expect([new SprinkleGridPlane('z').uAxis, new SprinkleGridPlane('z').vAxis]).toEqual(['x', 'y']);
  });

  it('composes points whose plane coordinates read back unchanged', () => {
    for (const { axis } of SPRINKLE_GRID_PLANE_TEST_AXES) {
      const plane = new SprinkleGridPlane(axis);
      const point = plane.pointCompose(1.5, -2.25, 3.75);
      expect([plane.uRead(point), plane.vRead(point), plane.heightRead(point)]).toEqual([1.5, -2.25, 3.75]);
    }
  });

  it('points the normal axis to the side the surface faces', () => {
    const plane = new SprinkleGridPlane('y');
    expect(plane.normalAxisToward(new THREE.Vector3(0.1, -0.9, 0)).y).toBe(-1);
    expect(plane.normalAxisToward(new THREE.Vector3(0.1, 0.9, 0)).y).toBe(1);
  });
});
