import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ProceduralPartBox } from '@/procedural/build/procedural_part_box.js';
import { ProceduralGeometryBuilder } from '@/procedural/build/procedural_geometry_builder.js';

/** Box parts are the convex building block of generators. */
describe('ProceduralPartBox', () => {
  const minimum = new THREE.Vector3(-1.5, 0.25, 2);
  const maximum = new THREE.Vector3(0.5, 3, 4.75);
  const part = ProceduralPartBox.create('Step', 'steps', minimum, maximum);
  const center = new THREE.Box3(minimum, maximum).getCenter(new THREE.Vector3());

  it('keeps its name and material slot', () => {
    expect(part.name).toBe('Step');
    expect(part.materialSlot).toBe('steps');
  });

  it('has six planar quads whose corners all lie on the box', () => {
    const box = new THREE.Box3(minimum, maximum).expandByScalar(1e-9);
    expect(part.faces).toHaveLength(6);
    for (const face of part.faces) {
      expect(face).toHaveLength(4);
      expect(face.every((corner) => box.containsPoint(corner))).toBe(true);
    }
  });

  it('winds every face so its normal points away from the box center', () => {
    for (const face of part.faces) {
      const normal = ProceduralGeometryBuilder.faceNormal(face);
      const faceCenter = face.reduce((sum, corner) => sum.add(corner), new THREE.Vector3()).divideScalar(face.length);
      expect(normal.length()).toBeCloseTo(1, 6);
      expect(normal.dot(faceCenter.sub(center))).toBeGreaterThan(0);
    }
  });

  it('is convex: every corner lies behind or on every face plane', () => {
    const corners = part.faces.flat();
    for (const face of part.faces) {
      const first = face[0] ?? center;
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(ProceduralGeometryBuilder.faceNormal(face), first);
      expect(corners.every((corner) => plane.distanceToPoint(corner) <= 1e-9)).toBe(true);
    }
  });
});
