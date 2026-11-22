import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { entityPickMeshIs } from '@/entity/model/entity_owner_keys.js';
import { CommandEntityArraySet } from '@/entity_array/commands/command_entity_array_set.js';
import type { EntityArraySettings } from '@/entity_array/model/entity_array_settings.js';
import { EntityArrayFollower } from '@/entity_array/sync/entity_array_follower.js';
import type { GameEntityClass } from '@/game_entity/class/game_entity_class_schema.js';
import { gameEntityCreateForClass } from '@/game_entity/owner/game_entity_owner.js';
import { CommandPrimitiveCreate } from '@/tools/creation/commands/command_primitive_create.js';
import { testClassesInstall, testClassListCreate } from '../game_entity/game_entity_test_classes.js';

/** Type path of the shelf class the array tests place. */
export const ENTITY_ARRAY_TEST_SHELF_TYPE_PATH = 'test::level::Shelf';

/** Box the shelf marker fills, in the shelf's own space. */
export const ENTITY_ARRAY_TEST_SHELF_BOX: { size: [number, number, number]; offset: [number, number, number] } = {
  size: [2, 1.5, 0.5],
  offset: [0, 0.75, 0],
};

/** Scene, undo stack and shelf class of one array test. */
export interface EntityArrayTestRig {
  readonly world: THREE.Group;
  readonly stack: CommandStack;
  readonly shelf: GameEntityClass;
}

/**
 * Returns a store shelf class whose fixture enum picks the box its marker
 * fills, the way store fixture classes declare their models.
 *
 * @returns Shelf class.
 */
export function entityArrayTestShelfClassCreate(): GameEntityClass {
  return {
    type_path: ENTITY_ARRAY_TEST_SHELF_TYPE_PATH,
    label: 'Shelf',
    category: 'Fixtures',
    placement: 'point',
    marker_color: [0.4, 0.7, 0.3],
    marker_box_field: 'fixture',
    marker_boxes: {
      tall: { size: [...ENTITY_ARRAY_TEST_SHELF_BOX.size], offset: [...ENTITY_ARRAY_TEST_SHELF_BOX.offset] },
      low: { size: [ENTITY_ARRAY_TEST_SHELF_BOX.size[0], 0.75, 0.5], offset: [0, 0.375, 0] },
    },
    fields: [{ path: 'fixture', label: 'Fixture', kind: 'enum', default: 'tall', variants: ['tall', 'low'] }],
  };
}

/**
 * Installs the shelf class and builds a scene whose undo stack the array
 * follower follows.
 *
 * @param cleanups Receives the uninstall callbacks.
 * @returns Test rig.
 */
export function entityArrayTestRigCreate(cleanups: (() => void)[]): EntityArrayTestRig {
  const shelf = entityArrayTestShelfClassCreate();
  const list = testClassListCreate();
  list.classes = [shelf];
  cleanups.push(testClassesInstall(list).uninstall);
  const world = new THREE.Group();
  const stack = new CommandStack(50);
  cleanups.push(new EntityArrayFollower(world).follow(stack));
  return { world, stack, shelf };
}

/**
 * Places a shelf through the undo stack.
 *
 * @param rig Test rig.
 * @param position Where the shelf stands.
 * @param fixture Fixture variant of the shelf.
 * @returns The placed shelf.
 */
export function entityArrayTestShelfPlace(
  rig: EntityArrayTestRig,
  position: THREE.Vector3,
  fixture = 'tall',
): THREE.Group {
  const owner = gameEntityCreateForClass(rig.shelf, { [rig.shelf.type_path]: { fixture } });
  owner.position.copy(position);
  rig.stack.push(new CommandPrimitiveCreate(owner, rig.world));
  return owner;
}

/**
 * Makes an entity repeat with the given settings through the undo stack.
 *
 * @param rig Test rig.
 * @param owner Entity owner.
 * @param settings New array settings, or null to stop repeating.
 */
export function entityArrayTestSettingsSet(
  rig: EntityArrayTestRig,
  owner: THREE.Object3D,
  settings: EntityArraySettings | null,
): void {
  rig.stack.push(new CommandEntityArraySet([owner], () => settings));
}

/**
 * Returns the clickable marker meshes below an entity, nested entities
 * included.
 *
 * @param owner Entity owner.
 * @returns Pick meshes in traversal order.
 */
export function entityArrayTestPickMeshesOf(owner: THREE.Object3D): THREE.Object3D[] {
  const meshes: THREE.Object3D[] = [];
  owner.traverse((object) => {
    if (entityPickMeshIs(object)) {
      meshes.push(object);
    }
  });
  return meshes;
}
