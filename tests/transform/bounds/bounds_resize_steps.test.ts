import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { BoundsFace } from '@/types/bounds_face.js';
import {
  boundsResizeStepApplyToBounds,
  boundsResizeStepsAppliedDeltas,
  boundsResizeStepsApplyToObject,
} from '@/transform/bounds/bounds_resize_steps.js';
import { computeOneSidedMeshResize, MIN_BOUNDS_HALF_EXTENT_FREE } from '@/transform/bounds/bounds_resize_math.js';
import { BuilderOrientedBounds, type DataOrientedBounds } from '@/transform/bounds/builder_oriented_bounds.js';

/**
 * Creates a box mesh with a given size, position and yaw.
 *
 * @param size Box size.
 * @param position Box position.
 * @param yawRadians Rotation around world Y.
 * @returns Box mesh with an up-to-date world matrix.
 */
function boxCreate(size: THREE.Vector3, position: THREE.Vector3, yawRadians: number): THREE.Mesh {
  const box = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), new THREE.MeshBasicMaterial());
  box.position.copy(position);
  box.rotation.y = yawRadians;
  box.updateMatrixWorld(true);
  return box;
}

/**
 * Builds oriented bounds of meshes and fails the test when there are none.
 *
 * @param meshes Meshes to measure.
 * @returns Oriented bounds.
 */
function boundsOf(meshes: THREE.Mesh[]): DataOrientedBounds {
  const bounds = new BuilderOrientedBounds().buildFromMeshes(meshes);
  if (!bounds) {
    throw new Error('Meshes must have bounds');
  }
  return bounds;
}

/**
 * Returns the world point of a bounds corner on the given faces (the faces'
 * axes at their face, the other axes at the center).
 *
 * @param bounds Oriented bounds.
 * @param signs Local sign per axis (0 keeps the center).
 * @returns World corner point.
 */
function boundsLocalPoint(bounds: DataOrientedBounds, signs: THREE.Vector3): THREE.Vector3 {
  const local = signs.clone().multiply(bounds.halfExtents);
  return local.applyQuaternion(bounds.quaternion).add(bounds.center);
}

/**
 * Applies a resize result to a mesh and rebuilds its bounds.
 *
 * @param box Mesh to update.
 * @param result New position and scale.
 * @returns Bounds after the resize.
 */
function boxResizedBounds(
  box: THREE.Mesh,
  result: { position: THREE.Vector3; scale: THREE.Vector3 },
): DataOrientedBounds {
  box.position.copy(result.position);
  box.scale.copy(result.scale);
  box.updateMatrixWorld(true);
  return boundsOf([box]);
}

/**
 * Corner resizes move two faces on different axes at once while the opposite
 * corner stays fixed; edge resizes still move one face.
 */
describe('bounds resize steps', () => {
  it('resizes both axes of a corner drag and keeps the opposite corner fixed', () => {
    const box = boxCreate(new THREE.Vector3(2, 1.5, 3), new THREE.Vector3(4, 0.75, -1), Math.PI / 7);
    const startBounds = boundsOf([box]);
    const oppositeCornerSigns = new THREE.Vector3(-1, 0, 1);
    const fixedBefore = boundsLocalPoint(startBounds, oppositeCornerSigns);
    const travelX = 0.75;
    const travelZ = 1.25;
    const steps = [
      { face: BoundsFace.POS_X, deltaAlongNormal: travelX },
      { face: BoundsFace.NEG_Z, deltaAlongNormal: travelZ },
    ];
    const result = boundsResizeStepsApplyToObject(
      box.position.clone(),
      box.scale.clone(),
      startBounds,
      steps,
      false,
      MIN_BOUNDS_HALF_EXTENT_FREE,
    );
    const after = boxResizedBounds(box, result);
    expect(after.halfExtents.x * 2).toBeCloseTo(startBounds.halfExtents.x * 2 + travelX, 6);
    expect(after.halfExtents.z * 2).toBeCloseTo(startBounds.halfExtents.z * 2 + travelZ, 6);
    expect(after.halfExtents.y).toBeCloseTo(startBounds.halfExtents.y, 6);
    expect(boundsLocalPoint(after, oppositeCornerSigns).distanceTo(fixedBefore)).toBeLessThan(1e-6);
  });

  it('matches the one-sided resize for a single edge step', () => {
    const box = boxCreate(new THREE.Vector3(1, 2, 1), new THREE.Vector3(-2, 1, 3), 0);
    const startBounds = boundsOf([box]);
    const step = { face: BoundsFace.POS_Y, deltaAlongNormal: 0.5 };
    const viaSteps = boundsResizeStepsApplyToObject(
      box.position.clone(),
      box.scale.clone(),
      startBounds,
      [step],
      false,
      MIN_BOUNDS_HALF_EXTENT_FREE,
    );
    const direct = computeOneSidedMeshResize(box.position, box.scale, startBounds, step.face, step.deltaAlongNormal);
    expect(viaSteps.position.distanceTo(direct.position)).toBeLessThan(1e-9);
    expect(viaSteps.scale.distanceTo(direct.scale)).toBeLessThan(1e-9);
  });

  it('keeps the opposite corner of a multi-object selection fixed', () => {
    const boxes = [
      boxCreate(new THREE.Vector3(1, 1, 1), new THREE.Vector3(0, 0.5, 0), 0),
      boxCreate(new THREE.Vector3(1, 1, 1), new THREE.Vector3(3, 0.5, 2), 0),
    ];
    const startBounds = boundsOf(boxes);
    const fixedBefore = boundsLocalPoint(startBounds, new THREE.Vector3(1, 0, 1));
    const steps = [
      { face: BoundsFace.NEG_X, deltaAlongNormal: 2 },
      { face: BoundsFace.NEG_Z, deltaAlongNormal: 1.5 },
    ];
    boxes.forEach((box) => {
      const result = boundsResizeStepsApplyToObject(box.position, box.scale, startBounds, steps, true, 0.01);
      box.position.copy(result.position);
      box.scale.copy(result.scale);
      box.updateMatrixWorld(true);
    });
    const after = boundsOf(boxes);
    expect(after.halfExtents.x * 2).toBeCloseTo(startBounds.halfExtents.x * 2 + 2, 6);
    expect(after.halfExtents.z * 2).toBeCloseTo(startBounds.halfExtents.z * 2 + 1.5, 6);
    expect(boundsLocalPoint(after, new THREE.Vector3(1, 0, 1)).distanceTo(fixedBefore)).toBeLessThan(1e-6);
  });

  it('moves only the dragged face of bounds data', () => {
    const bounds: DataOrientedBounds = {
      center: new THREE.Vector3(1, 2, 3),
      quaternion: new THREE.Quaternion(),
      halfExtents: new THREE.Vector3(1, 2, 0.5),
    };
    const fixedFace = boundsLocalPoint(bounds, new THREE.Vector3(0, 0, -1));
    const resized = boundsResizeStepApplyToBounds(bounds, { face: BoundsFace.POS_Z, deltaAlongNormal: 1 }, 0.01);
    expect(resized.halfExtents.z).toBeCloseTo(bounds.halfExtents.z + 0.5, 10);
    expect(resized.halfExtents.x).toBe(bounds.halfExtents.x);
    expect(boundsLocalPoint(resized, new THREE.Vector3(0, 0, -1)).distanceTo(fixedFace)).toBeLessThan(1e-9);
  });

  it('clamps each step at the minimum size', () => {
    const bounds: DataOrientedBounds = {
      center: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      halfExtents: new THREE.Vector3(1, 1, 1),
    };
    const minHalf = 0.25;
    const applied = boundsResizeStepsAppliedDeltas(
      bounds,
      [
        { face: BoundsFace.POS_X, deltaAlongNormal: -10 },
        { face: BoundsFace.POS_Y, deltaAlongNormal: 1 },
      ],
      minHalf,
    );
    expect(applied[0]).toBeCloseTo((minHalf - bounds.halfExtents.x) * 2, 10);
    expect(applied[1]).toBeCloseTo(1, 10);
  });
});
