import { describe, expect, it } from 'vitest';
import { CommandStack } from '@/commands/command_stack.js';
import { CommandLayerMove } from '@/layer/commands/command_layer_move.js';
import { LAYER_DEFAULT_ID } from '@/layer/model/layer_definition.js';
import { layerTestLayerAdd, layerTestWorldCreate } from '../layer_test_world.js';

/** Unit tests for moving a layer up and down the list. */
describe('CommandLayerMove', () => {
  it('moves a layer down and back up on undo', () => {
    const { manager } = layerTestWorldCreate();
    const stack = new CommandStack(16);
    const first = layerTestLayerAdd(manager, 'First');
    const second = layerTestLayerAdd(manager, 'Second');
    const firstIndex = manager.layerIndexOf(first.id);
    stack.push(new CommandLayerMove(manager, first.id, 1));
    expect(manager.layerIndexOf(first.id)).toBe(firstIndex + 1);
    expect(manager.layerIndexOf(second.id)).toBe(firstIndex);
    stack.undo();
    expect(manager.layerIndexOf(first.id)).toBe(firstIndex);
    stack.redo();
    expect(manager.layerIndexOf(first.id)).toBe(firstIndex + 1);
  });

  it('never moves a layer above the default layer or past the end', () => {
    const { manager } = layerTestWorldCreate();
    const only = layerTestLayerAdd(manager, 'Only');
    expect(new CommandLayerMove(manager, only.id, -1).hasChanges()).toBe(false);
    expect(new CommandLayerMove(manager, only.id, 1).hasChanges()).toBe(false);
    expect(new CommandLayerMove(manager, LAYER_DEFAULT_ID, 1).hasChanges()).toBe(false);
  });
});
