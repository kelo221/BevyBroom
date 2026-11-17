import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ProceduralPartFrame } from '@/procedural/build/procedural_part_frame.js';
import { proceduralPartBoundsOf, proceduralPartConvexIs } from '../procedural_part_test_checks.js';

/** Frames place boxes along a horizontal run, optionally rising with it. */
describe('ProceduralPartFrame', () => {
  const origin = new THREE.Vector3(2, 1, -3);
  const direction = new THREE.Vector3(3, 7, 4);

  it('runs along the horizontal part of a direction, with Y up', () => {
    const frame = new ProceduralPartFrame(origin, direction);
    const run = ProceduralPartFrame.runDirectionOf(direction);
    expect(run.y).toBe(0);
    expect(run.length()).toBeCloseTo(1, 9);
    expect(frame.pointToOwner(2, 0, 0).distanceTo(origin.clone().addScaledVector(run, 2))).toBeLessThan(1e-9);
    expect(frame.pointToOwner(0, 1.5, 0).distanceTo(origin.clone().add(new THREE.Vector3(0, 1.5, 0)))).toBeLessThan(
      1e-9,
    );
    const across = ProceduralPartFrame.acrossDirectionOf(direction);
    expect(across.dot(run)).toBeCloseTo(0, 9);
    expect(across.y).toBe(0);
  });

  it('falls back to the owner X axis for a vertical direction', () => {
    expect(ProceduralPartFrame.runDirectionOf(new THREE.Vector3(0, 5, 0)).toArray()).toEqual([1, 0, 0]);
  });

  it('builds convex boxes, sheared ones included, that rise by the slope', () => {
    const frame = new ProceduralPartFrame(origin, direction);
    const box = { runFrom: 0, runTo: 4, upFrom: -0.2, upTo: 0, acrossFrom: -1, acrossTo: 1 };
    const slope = 0.5;
    const level = frame.boxPart('Level', 'a', box);
    const sloped = frame.boxPart('Sloped', 'a', box, slope);
    expect(proceduralPartConvexIs(level)).toBe(true);
    expect(proceduralPartConvexIs(sloped)).toBe(true);
    const rise = proceduralPartBoundsOf(sloped).max.y - proceduralPartBoundsOf(level).max.y;
    expect(rise).toBeCloseTo(box.runTo * slope, 9);
  });
});
