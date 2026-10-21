import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { CommandLayerObjectsMove } from '@/layer/commands/command_layer_objects_move.js';
import { layerIdStoredRead, layerOfObjectResolve } from '@/layer/model/layer_membership.js';
import { layerTestBoxCreate, layerTestLayerAdd, layerTestWorldCreate } from '../layer_test_world.js';

/** Unit tests for moving objects into a layer. */
describe('CommandLayerObjectsMove', () => {
  it('moves top-level objects into a layer and restores their layers on undo', () => {
    const testWorld = layerTestWorldCreate();
    const stack = new CommandStack(16);
    const target = layerTestLayerAdd(testWorld.manager, 'Target');
    const box = layerTestBoxCreate('box');
    testWorld.world.add(box);
    const previousLayer = layerIdStoredRead(box);
    stack.push(new CommandLayerObjectsMove(testWorld.manager, [box], target.id));
    expect(layerIdStoredRead(box)).toBe(target.id);
    stack.undo();
    expect(layerIdStoredRead(box)).toBe(previousLayer);
    stack.redo();
    expect(layerIdStoredRead(box)).toBe(target.id);
  });

  it('moves nested objects with their top-level ancestor, once', () => {
    const testWorld = layerTestWorldCreate();
    const target = layerTestLayerAdd(testWorld.manager, 'Target');
    const group = new THREE.Group();
    testWorld.world.add(group);
    const firstChild = layerTestBoxCreate('first');
    const secondChild = layerTestBoxCreate('second');
    group.add(firstChild, secondChild);
    const command = new CommandLayerObjectsMove(testWorld.manager, [firstChild, secondChild], target.id);
    expect(command.objectsRead()).toEqual([group]);
    command.execute();
    expect(layerOfObjectResolve(secondChild)?.id).toBe(target.id);
  });

  it('has no effect for unknown layers or objects already in the layer', () => {
    const testWorld = layerTestWorldCreate();
    const box = layerTestBoxCreate('box');
    testWorld.world.add(box);
    const defaultLayer = testWorld.manager.layerDefaultRead();
    expect(new CommandLayerObjectsMove(testWorld.manager, [box], 'missing_layer').hasChanges()).toBe(false);
    expect(new CommandLayerObjectsMove(testWorld.manager, [box], defaultLayer.id).hasChanges()).toBe(false);
  });
});
