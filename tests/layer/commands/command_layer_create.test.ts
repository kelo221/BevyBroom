import { describe, expect, it } from 'vitest';
import { CommandStack } from '@/commands/command_stack.js';
import { CommandLayerCreate } from '@/layer/commands/command_layer_create.js';
import { LAYER_DEFAULT_ID } from '@/layer/model/layer_definition.js';
import { layerTestWorldCreate } from '../layer_test_world.js';

/** Unit tests for the undoable creation of a layer. */
describe('CommandLayerCreate', () => {
  it('adds a named layer at the end and removes it on undo, then adds it again on redo', () => {
    const { manager } = layerTestWorldCreate();
    const stack = new CommandStack(16);
    const command = new CommandLayerCreate(manager, '  Props  ');
    stack.push(command);
    const created = command.definitionRead();
    expect(created.name).toBe('Props');
    expect(manager.layersList().at(-1)?.id).toBe(created.id);
    stack.undo();
    expect(manager.layerFind(created.id)).toBeNull();
    stack.redo();
    expect(manager.layerFind(created.id)?.name).toBe('Props');
  });

  it('names layers "Layer N" when no name is given', () => {
    const { manager } = layerTestWorldCreate();
    const command = new CommandLayerCreate(manager);
    expect(command.definitionRead().name).toMatch(/^Layer \d+$/);
    expect(command.definitionRead().id).not.toBe(LAYER_DEFAULT_ID);
  });

  it('makes the default layer current when undo removes the current layer', () => {
    const { manager } = layerTestWorldCreate();
    const stack = new CommandStack(16);
    const command = new CommandLayerCreate(manager);
    stack.push(command);
    manager.currentLayerSet(command.definitionRead().id);
    stack.undo();
    expect(manager.currentLayerIdRead()).toBe(LAYER_DEFAULT_ID);
  });
});
