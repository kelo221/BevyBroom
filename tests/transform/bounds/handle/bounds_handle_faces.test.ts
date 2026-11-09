import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { BoundsFace } from '@/types/bounds_face.js';
import { GizmoAxis } from '@/types/transform_mode.js';
import {
  BOUNDS_HANDLE_FACES_KEY,
  boundsFaceAxisLetter,
  boundsHandleCornerFacePairsAll,
  boundsHandleFacesEqual,
  boundsHandleFacesGizmoAxis,
  boundsHandleFacesIsCorner,
  boundsHandleFacesLocalAnchorWrite,
  boundsHandleFacesLocalPullDirection,
  boundsHandleFacesRead,
  boundsHandleFacesSmallestHalfExtent,
  boundsHandleFacesTouchAxes,
  boundsHandleFacesWrite,
} from '@/transform/bounds/handle/bounds_handle_faces.js';
import { getBoundsFaceHalfExtent, getBoundsFaceLocalNormal } from '@/transform/bounds/builder_oriented_bounds.js';

/**
 * Face-list descriptors of bounds resize handles: one face for an edge handle,
 * two faces on different axes for a corner handle.
 */
describe('bounds handle face lists', () => {
  it('lists twelve distinct corner pairs, each on two different axes', () => {
    const pairs = boundsHandleCornerFacePairsAll();
    const keys = new Set(pairs.map((pair) => [...pair].sort().join('|')));
    expect(pairs).toHaveLength(12);
    expect(keys.size).toBe(12);
    pairs.forEach((pair) => {
      expect(pair).toHaveLength(2);
      const [first, second] = pair;
      expect(first && second && boundsFaceAxisLetter(first) !== boundsFaceAxisLetter(second)).toBe(true);
    });
  });

  it('gives each view plane exactly four corners whose axes lie in it', () => {
    const planeAxes: Array<Array<'x' | 'y' | 'z'>> = [
      ['x', 'z'],
      ['x', 'y'],
      ['y', 'z'],
    ];
    planeAxes.forEach((axes) => {
      const depthAxes = (['x', 'y', 'z'] as const).filter((axis) => !axes.includes(axis));
      const inPlane = boundsHandleCornerFacePairsAll().filter((pair) => !boundsHandleFacesTouchAxes(pair, depthAxes));
      expect(inPlane).toHaveLength(4);
    });
  });

  it('maps edge handles to single axes and corners to plane axes', () => {
    expect(boundsHandleFacesGizmoAxis([BoundsFace.NEG_Y])).toBe(GizmoAxis.Y);
    expect(boundsHandleFacesGizmoAxis([BoundsFace.POS_Z, BoundsFace.NEG_X])).toBe(GizmoAxis.XZ_PLANE);
    expect(boundsHandleFacesGizmoAxis([BoundsFace.POS_Y, BoundsFace.POS_X])).toBe(GizmoAxis.XY_PLANE);
    expect(boundsHandleFacesGizmoAxis([BoundsFace.NEG_Z, BoundsFace.NEG_Y])).toBe(GizmoAxis.YZ_PLANE);
    expect(boundsHandleFacesIsCorner([BoundsFace.POS_X])).toBe(false);
    expect(boundsHandleFacesIsCorner([BoundsFace.POS_X, BoundsFace.POS_Y])).toBe(true);
  });

  it('compares face lists regardless of order', () => {
    expect(boundsHandleFacesEqual([BoundsFace.POS_X, BoundsFace.NEG_Z], [BoundsFace.NEG_Z, BoundsFace.POS_X])).toBe(
      true,
    );
    expect(boundsHandleFacesEqual([BoundsFace.POS_X], [BoundsFace.POS_X, BoundsFace.NEG_Z])).toBe(false);
    expect(boundsHandleFacesEqual([BoundsFace.POS_X], [BoundsFace.NEG_X])).toBe(false);
  });

  it('anchors a corner on both faces pushed out by the gap along each normal', () => {
    const halfExtents = new THREE.Vector3(1.5, 0.75, 2.25);
    const gap = 0.2;
    const faces = [BoundsFace.NEG_X, BoundsFace.POS_Z];
    const anchor = boundsHandleFacesLocalAnchorWrite(faces, halfExtents, gap, new THREE.Vector3(9, 9, 9));
    const expected = new THREE.Vector3();
    faces.forEach((face) => {
      expected.addScaledVector(getBoundsFaceLocalNormal(face), getBoundsFaceHalfExtent(halfExtents, face) + gap);
    });
    expect(anchor.distanceTo(expected)).toBeLessThan(1e-9);
    expect(anchor.y).toBeCloseTo(0, 10);
  });

  it('pulls a corner along the sum of both face normals', () => {
    const pull = boundsHandleFacesLocalPullDirection([BoundsFace.POS_X, BoundsFace.NEG_Y]);
    const expected = getBoundsFaceLocalNormal(BoundsFace.POS_X).add(getBoundsFaceLocalNormal(BoundsFace.NEG_Y));
    expect(pull.distanceTo(expected)).toBeLessThan(1e-9);
  });

  it('reads the smallest half extent along the corner axes', () => {
    const halfExtents = new THREE.Vector3(3, 0.5, 2);
    const faces = [BoundsFace.POS_X, BoundsFace.NEG_Z];
    expect(boundsHandleFacesSmallestHalfExtent(faces, halfExtents)).toBe(
      Math.min(getBoundsFaceHalfExtent(halfExtents, faces[0] ?? BoundsFace.POS_X), halfExtents.z),
    );
    expect(boundsHandleFacesSmallestHalfExtent([], halfExtents)).toBe(0);
  });

  it('round-trips the face list through userData and survives object cloning', () => {
    const mesh = new THREE.Mesh();
    boundsHandleFacesWrite(mesh, [BoundsFace.POS_Y, BoundsFace.NEG_X]);
    const clone = mesh.clone();
    expect(boundsHandleFacesRead(clone)).toEqual([BoundsFace.POS_Y, BoundsFace.NEG_X]);
    clone.userData[BOUNDS_HANDLE_FACES_KEY] = ['not_a_face', BoundsFace.NEG_Z];
    expect(boundsHandleFacesRead(clone)).toEqual([BoundsFace.NEG_Z]);
    expect(boundsHandleFacesRead(new THREE.Object3D())).toEqual([]);
  });
});
