import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { CommandEntityDuplicate } from '@/entity/commands/command_entity_duplicate.js';
import { SceneSerializer } from '@/io/scene/scene_serializer.js';
import { SceneDeserializer } from '@/io/scene/scene_deserializer.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { lightSettingsCreateDefault } from '@/light/model/light_settings.js';
import { CommandObjectHierarchyDelete } from '@/outliner/commands/command_object_hierarchy_delete.js';
import { CommandObjectReparent } from '@/outliner/commands/command_object_reparent.js';
import { PreviewStateObjectCollector } from '@/preview/state/preview_state_object_collector.js';

/** The repeat count of the duplicate, delete, undo and redo cycle. */
const IDENTITY_CYCLE_COUNT = 25;

/**
 * Builds a world with a hall group holding a wall mesh and a lamp, plus a loose
 * crate.
 *
 * @returns The world and its named objects.
 */
function identityWorldCreate(): {
  world: THREE.Group;
  hall: THREE.Group;
  lamp: THREE.Object3D;
  crate: THREE.Mesh;
} {
  const world = new THREE.Group();
  const hall = new THREE.Group();
  hall.name = 'Hall';
  hall.position.set(3, 0, -2);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 0.2), new THREE.MeshStandardMaterial());
  wall.name = 'Wall';
  const lamp = LightOwner.create('Lamp', lightSettingsCreateDefault('point'));
  lamp.position.set(0, 2.5, 0);
  hall.add(wall, lamp);
  const crate = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
  crate.name = 'Crate';
  world.add(hall, crate);
  return { world, hall, lamp, crate };
}

/**
 * The authored ids the game would receive for `world`, in hierarchy order.
 *
 * @param world The document's world group.
 * @returns The authored object ids.
 */
function authoredIdsRead(world: THREE.Group): string[] {
  return PreviewStateObjectCollector.collect(world).map((object) => object.id);
}

/**
 * The authored parent id the game would receive for the object `id`.
 *
 * @param world The document's world group.
 * @param id The authored object id.
 * @returns The parent id, null for a root, undefined when the object is not
 *   sent.
 */
function authoredParentIdRead(world: THREE.Group, id: string): string | null | undefined {
  return PreviewStateObjectCollector.collect(world).find((object) => object.id === id)?.parent_id;
}

/**
 * Runs one duplicate, delete, undo, redo cycle on `source` that ends with no
 * lasting change.
 *
 * @param stack The undo stack the commands go through.
 * @param source The object that is duplicated.
 */
function identityCycleRun(stack: CommandStack, source: THREE.Object3D): void {
  const duplicate = new CommandEntityDuplicate([source]);
  stack.push(duplicate);
  const clones = duplicate.getClonedOwners();
  stack.push(new CommandObjectHierarchyDelete([...clones]));
  stack.undo();
  stack.redo();
  stack.undo();
  stack.undo();
}

/**
 * Authored object identity is what the game keys its entities on, so it must
 * stay stable through saving, loading and hierarchy edits, and repeated edits
 * must not grow the object set the game receives.
 */
describe('preview state identity regression', () => {
  it('sends the same ids after the document is saved and loaded again', () => {
    const { world } = identityWorldCreate();
    const idsBeforeSave = authoredIdsRead(world);
    const saved = JSON.parse(JSON.stringify(new SceneSerializer().serialize(world)));
    const reloadedWorld = new THREE.Group();
    new SceneDeserializer().deserialize(saved, reloadedWorld);
    expect(authoredIdsRead(reloadedWorld)).toEqual(idsBeforeSave);
  });

  it('keeps an object id through reparenting and its undo while the parent id follows', () => {
    const { world, hall, lamp } = identityWorldCreate();
    const stack = new CommandStack(8);
    stack.push(new CommandObjectReparent(lamp, world));
    expect(authoredParentIdRead(world, lamp.uuid)).toBeNull();
    stack.undo();
    expect(authoredParentIdRead(world, lamp.uuid)).toBe(hall.uuid);
    stack.redo();
    expect(authoredIdsRead(world)).toContain(lamp.uuid);
  });

  it('gives every duplicate a new id that survives undo and redo', () => {
    const { world, crate } = identityWorldCreate();
    const stack = new CommandStack(8);
    const duplicate = new CommandEntityDuplicate([crate]);
    stack.push(duplicate);
    const cloneIds = duplicate.getClonedOwners().map((clone) => clone.uuid);
    expect(cloneIds).not.toContain(crate.uuid);
    stack.undo();
    stack.redo();
    const ids = authoredIdsRead(world);
    cloneIds.forEach((cloneId) => expect(ids).toContain(cloneId));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('ends repeated duplicate, delete, undo and redo cycles with the original object set', () => {
    const { world, hall, crate } = identityWorldCreate();
    const idsBeforeCycles = authoredIdsRead(world);
    const stack = new CommandStack(IDENTITY_CYCLE_COUNT * 4);
    for (let cycleIndex = 0; cycleIndex < IDENTITY_CYCLE_COUNT; cycleIndex++) {
      identityCycleRun(stack, cycleIndex % 2 === 0 ? crate : hall);
    }
    expect(authoredIdsRead(world)).toEqual(idsBeforeCycles);
  });
});
