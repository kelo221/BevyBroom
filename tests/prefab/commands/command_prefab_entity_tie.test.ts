import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import {
  CommandPrefabEntityTie,
  PREFAB_ENTITY_TIE_DEFAULT_CLASS,
  PREFAB_ENTITY_TIE_GROUP_NAME,
} from '@/prefab/commands/command_prefab_entity_tie.js';

/**
 * Builds a world root holding the given number of fresh meshes.
 *
 * @param meshCount Number of meshes to add.
 * @returns World root and its meshes in order.
 */
function prefabTieTestWorldCreate(meshCount: number): { world: THREE.Group; meshes: THREE.Mesh[] } {
  const world = new THREE.Group();
  const meshes = Array.from({ length: meshCount }, () => new THREE.Mesh());
  meshes.forEach((mesh) => world.add(mesh));
  return { world, meshes };
}

/** Unit tests for the undoable toEntity command. */
describe('CommandPrefabEntityTie', () => {
  it('groups several objects under a tagged group and undo/redo restores both states', () => {
    const { world, meshes } = prefabTieTestWorldCreate(2);
    const stack = new CommandStack(8);
    const tie = CommandPrefabEntityTie.create(meshes, world);
    if (!tie) throw new Error('tie expected for a non-empty selection');
    stack.push(tie);
    const group = tie.targetRead();
    expect(group.name).toBe(PREFAB_ENTITY_TIE_GROUP_NAME);
    expect(group.parent).toBe(world);
    meshes.forEach((mesh) => expect(mesh.parent).toBe(group));
    expect(GameEntityComponentStore.read(group)[PREFAB_ENTITY_TIE_DEFAULT_CLASS]).toBeDefined();
    stack.undo();
    expect(group.parent).toBeNull();
    meshes.forEach((mesh) => expect(mesh.parent).toBe(world));
    expect(GameEntityComponentStore.hasAny(group)).toBe(false);
    stack.redo();
    expect(group.parent).toBe(world);
    expect(GameEntityComponentStore.read(group)[PREFAB_ENTITY_TIE_DEFAULT_CLASS]).toBeDefined();
  });

  it('tags a single selected group in place without regrouping it', () => {
    const world = new THREE.Group();
    const existingGroup = new THREE.Group();
    world.add(existingGroup);
    const tie = CommandPrefabEntityTie.create([existingGroup], world);
    if (!tie) throw new Error('tie expected for an untagged group');
    tie.execute();
    expect(tie.targetRead()).toBe(existingGroup);
    expect(existingGroup.parent).toBe(world);
    expect(GameEntityComponentStore.hasAny(existingGroup)).toBe(true);
    tie.undo();
    expect(GameEntityComponentStore.hasAny(existingGroup)).toBe(false);
  });

  it('returns null for an empty selection or a group that already has the component', () => {
    const world = new THREE.Group();
    expect(CommandPrefabEntityTie.create([], world)).toBeNull();
    const taggedGroup = new THREE.Group();
    GameEntityComponentStore.write(taggedGroup, { [PREFAB_ENTITY_TIE_DEFAULT_CLASS]: {} });
    expect(CommandPrefabEntityTie.create([taggedGroup], world)).toBeNull();
  });
});
