import { describe, expect, it } from 'vitest';
import { CommandStack } from '@/commands/command_stack.js';
import { CommandLayerRemove } from '@/layer/commands/command_layer_remove.js';
import { LAYER_DEFAULT_ID } from '@/layer/model/layer_definition.js';
import { layerIdStoredRead } from '@/layer/model/layer_membership.js';
import { layerTestBoxAddToLayer, layerTestLayerAdd, layerTestWorldCreate } from '../layer_test_world.js';

/** Unit tests for the undoable removal of a layer. */
describe('CommandLayerRemove', () => {
  it('moves the objects to the default layer and restores everything on undo', () => {
    const testWorld = layerTestWorldCreate();
    const stack = new CommandStack(16);
    const before = layerTestLayerAdd(testWorld.manager, 'Before');
    const removed = layerTestLayerAdd(testWorld.manager, 'Removed');
    layerTestLayerAdd(testWorld.manager, 'After');
    const box = layerTestBoxAddToLayer(testWorld, removed.id, 'box');
    testWorld.manager.currentLayerSet(removed.id);
    const removedIndex = testWorld.manager.layerIndexOf(removed.id);
    stack.push(new CommandLayerRemove(testWorld.manager, removed.id));
    expect(testWorld.manager.layerFind(removed.id)).toBeNull();
    expect(layerIdStoredRead(box)).toBe(LAYER_DEFAULT_ID);
    expect(testWorld.manager.currentLayerIdRead()).toBe(LAYER_DEFAULT_ID);
    stack.undo();
    expect(testWorld.manager.layerIndexOf(removed.id)).toBe(removedIndex);
    expect(testWorld.manager.layerIndexOf(before.id)).toBe(removedIndex - 1);
    expect(layerIdStoredRead(box)).toBe(removed.id);
    expect(testWorld.manager.currentLayerIdRead()).toBe(removed.id);
    stack.redo();
    expect(testWorld.manager.layerFind(removed.id)).toBeNull();
  });

  it('has no effect on the default layer', () => {
    const { manager } = layerTestWorldCreate();
    const command = new CommandLayerRemove(manager, LAYER_DEFAULT_ID);
    expect(command.hasChanges()).toBe(false);
    command.execute();
    expect(manager.layerFind(LAYER_DEFAULT_ID)).not.toBeNull();
  });
});
