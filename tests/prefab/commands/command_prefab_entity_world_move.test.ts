import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { GameEntityLogicStore } from '@/game_entity/logic/game_entity_logic_store.js';
import { CommandPrefabEntityWorldMove } from '@/prefab/commands/command_prefab_entity_world_move.js';

const PREFAB_WORLD_MOVE_TEST_CLASS = 'prefab_world_move_test::Component';

/**
 * Builds an entity group carrying one component and one entity I/O output.
 *
 * @returns Tagged group.
 */
function prefabWorldMoveTestEntityCreate(): THREE.Group {
  const entity = new THREE.Group();
  GameEntityComponentStore.write(entity, { [PREFAB_WORLD_MOVE_TEST_CLASS]: {} });
  GameEntityLogicStore.write(entity, [
    { output: 'OnTrigger', target: 'Target', input: 'Open', parameter: '', delay: 0, times_to_fire: -1 },
  ]);
  return entity;
}

/** Unit tests for the undoable toWorld command. */
describe('CommandPrefabEntityWorldMove', () => {
  it('strips components and outputs and undo/redo restores and strips them again', () => {
    const entity = prefabWorldMoveTestEntityCreate();
    const componentsBefore = GameEntityComponentStore.read(entity);
    const outputsBefore = GameEntityLogicStore.read(entity);
    const stack = new CommandStack(8);
    const worldMove = CommandPrefabEntityWorldMove.create([entity]);
    if (!worldMove) throw new Error('world move expected for a tagged entity');
    stack.push(worldMove);
    expect(GameEntityComponentStore.hasAny(entity)).toBe(false);
    expect(GameEntityLogicStore.read(entity)).toEqual([]);
    stack.undo();
    expect(GameEntityComponentStore.read(entity)).toEqual(componentsBefore);
    expect(GameEntityLogicStore.read(entity)).toEqual(outputsBefore);
    stack.redo();
    expect(GameEntityComponentStore.hasAny(entity)).toBe(false);
    expect(GameEntityLogicStore.read(entity)).toEqual([]);
  });

  it('returns null when no object carries entity data', () => {
    expect(CommandPrefabEntityWorldMove.create([new THREE.Mesh()])).toBeNull();
    expect(CommandPrefabEntityWorldMove.create([])).toBeNull();
  });
});
