import { describe, expect, it } from 'vitest';
import { CommandStack } from '@/commands/command_stack.js';
import { CommandLayerRename } from '@/layer/commands/command_layer_rename.js';
import { LAYER_DEFAULT_ID } from '@/layer/model/layer_definition.js';
import { layerTestLayerAdd, layerTestWorldCreate } from '../layer_test_world.js';

/** Unit tests for the undoable rename of a layer. */
describe('CommandLayerRename', () => {
  it('renames a layer and restores the old name on undo', () => {
    const { manager } = layerTestWorldCreate();
    const stack = new CommandStack(16);
    const layer = layerTestLayerAdd(manager, 'Old');
    stack.push(new CommandLayerRename(manager, layer.id, 'New'));
    expect(manager.layerFind(layer.id)?.name).toBe('New');
    stack.undo();
    expect(manager.layerFind(layer.id)?.name).toBe('Old');
    stack.redo();
    expect(manager.layerFind(layer.id)?.name).toBe('New');
  });

  it('has no effect for the default layer, blank names or the same name', () => {
    const { manager } = layerTestWorldCreate();
    const layer = layerTestLayerAdd(manager, 'Same');
    expect(new CommandLayerRename(manager, LAYER_DEFAULT_ID, 'Other').hasChanges()).toBe(false);
    expect(new CommandLayerRename(manager, layer.id, '   ').hasChanges()).toBe(false);
    expect(new CommandLayerRename(manager, layer.id, 'Same').hasChanges()).toBe(false);
  });
});
