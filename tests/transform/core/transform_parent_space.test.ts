import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { TransformParentSpace } from '@/transform/core/transform_parent_space.js';

/**
 * Proves that a world offset converted into parent space moves an object by
 * exactly that offset in the world.
 */
describe('TransformParentSpace.worldOffsetToParentLocal', () => {
  it('returns an equal copy for an object without a parent', () => {
    const object = new THREE.Object3D();
    const worldOffset = new THREE.Vector3(1.5, -2, 0.75);
    const localOffset = TransformParentSpace.worldOffsetToParentLocal(object, worldOffset);
    expect(localOffset.equals(worldOffset)).toBe(true);
    expect(localOffset).not.toBe(worldOffset);
  });

  it('moves an object by the world offset under a turned, scaled and moved parent', () => {
    const parent = new THREE.Group();
    parent.position.set(4, -1, 2);
    parent.rotation.set(0.3, Math.PI / 2, -0.5);
    parent.scale.set(2, 0.5, 1.5);
    const object = new THREE.Object3D();
    object.position.set(1, 2, 3);
    parent.add(object);
    parent.updateMatrixWorld(true);
    const worldStart = object.getWorldPosition(new THREE.Vector3());
    const worldOffset = new THREE.Vector3(0, 0, 0.75);
    object.position.add(TransformParentSpace.worldOffsetToParentLocal(object, worldOffset));
    object.updateMatrixWorld(true);
    const worldMove = object.getWorldPosition(new THREE.Vector3()).sub(worldStart);
    expect(worldMove.distanceTo(worldOffset)).toBeLessThan(1e-9);
  });
});
