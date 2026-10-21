import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  layerOfObjectResolve,
  layerTopLevelObjectResolve,
  objectInHiddenLayerIs,
  objectInLockedLayerIs,
  objectInOmittedLayerIs,
  objectInUnselectableLayerIs,
} from '@/layer/model/layer_membership.js';
import { filterUnlockedObjects, isObjectOrAncestorLocked } from '@/utils/object_lock.js';
import {
  layerTestBoxAddToLayer,
  layerTestBoxCreate,
  layerTestLayerAdd,
  layerTestWorldCreate,
} from '../layer_test_world.js';

/**
 * Unit tests for layer membership: nested objects resolve through their
 * top-level ancestor, flags of the layer apply to the whole subtree, and
 * objects outside a managed world belong to no layer.
 */
describe('layer_membership', () => {
  it('resolves nested objects through their top-level ancestor', () => {
    const testWorld = layerTestWorldCreate();
    const layer = layerTestLayerAdd(testWorld.manager, 'Nested');
    testWorld.manager.currentLayerSet(layer.id);
    const group = new THREE.Group();
    testWorld.world.add(group);
    const nested = layerTestBoxCreate('nested');
    group.add(nested);
    expect(layerTopLevelObjectResolve(nested)).toBe(group);
    expect(layerOfObjectResolve(nested)?.id).toBe(layer.id);
  });

  it('reports the switches of the layer an object belongs to', () => {
    const testWorld = layerTestWorldCreate();
    const layer = layerTestLayerAdd(testWorld.manager, 'Flags');
    const box = layerTestBoxAddToLayer(testWorld, layer.id, 'box');
    expect(objectInUnselectableLayerIs(box)).toBe(false);
    testWorld.manager.layerFlagSet(layer.id, 'hidden', true);
    testWorld.manager.layerFlagSet(layer.id, 'omitFromExport', true);
    expect(objectInHiddenLayerIs(box)).toBe(true);
    expect(objectInOmittedLayerIs(box)).toBe(true);
    expect(objectInLockedLayerIs(box)).toBe(false);
    expect(objectInUnselectableLayerIs(box)).toBe(true);
  });

  it('gives objects outside a managed world no layer', () => {
    const plainWorld = new THREE.Group();
    const box = layerTestBoxCreate('box');
    plainWorld.add(box);
    expect(layerOfObjectResolve(box)).toBeNull();
    expect(objectInHiddenLayerIs(box)).toBe(false);
  });

  it('makes objects of locked layers count as locked for every edit filter', () => {
    const testWorld = layerTestWorldCreate();
    const layer = layerTestLayerAdd(testWorld.manager, 'Locked');
    const lockedBox = layerTestBoxAddToLayer(testWorld, layer.id, 'locked');
    const freeBox = layerTestBoxCreate('free');
    testWorld.world.add(freeBox);
    testWorld.manager.layerFlagSet(layer.id, 'locked', true);
    expect(isObjectOrAncestorLocked(lockedBox)).toBe(true);
    expect(filterUnlockedObjects([lockedBox, freeBox])).toEqual([freeBox]);
  });
});
