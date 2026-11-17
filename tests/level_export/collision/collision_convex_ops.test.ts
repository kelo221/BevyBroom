import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CollisionConvexOps } from '@/level_export/collision/collision_convex_ops.js';
import { SolidBrushFactory } from '@/solid/brush/solid_brush_factory.js';

/**
 * Returns the volume of a box.
 *
 * @param box Box.
 * @returns Volume.
 */
function volumeOfBox(box: THREE.Box3): number {
  const size = box.getSize(new THREE.Vector3());
  return size.x * size.y * size.z;
}

const outer = new THREE.Box3(new THREE.Vector3(-2, 0, -1), new THREE.Vector3(2, 3, 1));
const notch = new THREE.Box3(new THREE.Vector3(-0.5, 1, -2), new THREE.Vector3(0.5, 4, 2));

/** Convex differences and intersections keep the right volume. */
describe('CollisionConvexOps', () => {
  it('measures the volume of a convex brush', () => {
    expect(CollisionConvexOps.volumeOf(SolidBrushFactory.createBox(outer.min, outer.max))).toBeCloseTo(
      volumeOfBox(outer),
      9,
    );
  });

  it('splits a difference into convex pieces whose volumes add up', () => {
    const pieces = CollisionConvexOps.subtract(
      SolidBrushFactory.createBox(outer.min, outer.max),
      SolidBrushFactory.createBox(notch.min, notch.max),
    );
    const carved = volumeOfBox(outer.clone().intersect(notch));
    const total = pieces.reduce((sum, piece) => sum + CollisionConvexOps.volumeOf(piece), 0);
    expect(pieces.length).toBeGreaterThan(1);
    expect(total).toBeCloseTo(volumeOfBox(outer) - carved, 6);
  });

  it('returns the subject untouched when the cutter misses it', () => {
    const subject = SolidBrushFactory.createBox(outer.min, outer.max);
    const far = SolidBrushFactory.createBox(new THREE.Vector3(10, 10, 10), new THREE.Vector3(11, 11, 11));
    expect(CollisionConvexOps.subtract(subject, far)).toEqual([subject]);
    expect(CollisionConvexOps.intersect(subject, far)).toBeNull();
  });

  it('keeps the common part of an intersection', () => {
    const common = CollisionConvexOps.intersect(
      SolidBrushFactory.createBox(outer.min, outer.max),
      SolidBrushFactory.createBox(notch.min, notch.max),
    );
    expect(common ? CollisionConvexOps.volumeOf(common) : 0).toBeCloseTo(
      volumeOfBox(outer.clone().intersect(notch)),
      6,
    );
  });
});
