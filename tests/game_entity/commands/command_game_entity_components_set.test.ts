import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { CommandGameEntityComponentsSet } from '@/game_entity/commands/command_game_entity_components_set.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { GameEntityComponentsEdit } from '@/game_entity/component/game_entity_components_edit.js';
import { TEST_SPINNER_TYPE_PATH } from '../game_entity_test_classes.js';

/**
 * Component edits of several objects are one undoable step that restores each
 * object's own previous overrides.
 */
describe('CommandGameEntityComponentsSet', () => {
  it('edits every object and restores each one on undo and redo', () => {
    const first = new THREE.Mesh();
    const second = new THREE.Group();
    GameEntityComponentStore.write(first, { [TEST_SPINNER_TYPE_PATH]: { speed: 3 } });
    const firstBefore = GameEntityComponentStore.read(first);
    const stack = new CommandStack(4);
    const command = new CommandGameEntityComponentsSet([first, second], (components) =>
      GameEntityComponentsEdit.componentAdd(components, TEST_SPINNER_TYPE_PATH),
    );
    expect(command.hasChanges()).toBe(true);
    stack.push(command);
    expect(GameEntityComponentStore.read(first)).toEqual(firstBefore);
    expect(GameEntityComponentStore.read(second)).toEqual({ [TEST_SPINNER_TYPE_PATH]: {} });
    stack.undo();
    expect(GameEntityComponentStore.hasAny(second)).toBe(false);
    expect(GameEntityComponentStore.read(first)).toEqual(firstBefore);
    stack.redo();
    expect(GameEntityComponentStore.read(second)).toEqual({ [TEST_SPINNER_TYPE_PATH]: {} });
  });

  it('reports no changes when the edit changes nothing', () => {
    const object = new THREE.Group();
    GameEntityComponentStore.write(object, { [TEST_SPINNER_TYPE_PATH]: {} });
    const command = new CommandGameEntityComponentsSet([object], (components) =>
      GameEntityComponentsEdit.componentAdd(components, TEST_SPINNER_TYPE_PATH),
    );
    expect(command.hasChanges()).toBe(false);
  });
});
