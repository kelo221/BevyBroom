import { describe, expect, it } from 'vitest';
import { CommandStack } from '@/commands/command_stack.js';
import { CommandLayerFlagSet } from '@/layer/commands/command_layer_flag_set.js';
import { LAYER_FLAG_NAMES } from '@/layer/model/layer_definition.js';
import { layerTestLayerAdd, layerTestWorldCreate } from '../layer_test_world.js';

/** Unit tests for setting the switches of a layer. */
describe('CommandLayerFlagSet', () => {
  it.each(LAYER_FLAG_NAMES)('sets %s and restores it on undo', (flag) => {
    const { manager } = layerTestWorldCreate();
    const stack = new CommandStack(16);
    const layer = layerTestLayerAdd(manager, 'Switches');
    const command = new CommandLayerFlagSet(manager, layer.id, flag, true);
    expect(command.hasChanges()).toBe(true);
    stack.push(command);
    expect(manager.layerFind(layer.id)?.[flag]).toBe(true);
    stack.undo();
    expect(manager.layerFind(layer.id)?.[flag]).toBe(false);
    stack.redo();
    expect(manager.layerFind(layer.id)?.[flag]).toBe(true);
  });

  it('has no effect when the switch already has the value', () => {
    const { manager } = layerTestWorldCreate();
    const layer = layerTestLayerAdd(manager, 'Unchanged');
    expect(new CommandLayerFlagSet(manager, layer.id, 'hidden', false).hasChanges()).toBe(false);
  });
});
