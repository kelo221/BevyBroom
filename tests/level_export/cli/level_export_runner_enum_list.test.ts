import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { LevelExportRunner } from '@/level_export/cli/level_export_runner.js';
import { COLLISION_FILE_NAME, type CollisionDocument } from '@/level_export/collision/collision_types.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';
import { collisionTestModelCreate } from '../collision/collision_test_models.js';
import {
  type LevelExportTestProject,
  levelExportTestProjectCreate,
  levelExportTestProjectRemove,
} from '../level_export_test_project.js';
import {
  TEST_SHELF_RUN_LIST_PATH,
  TEST_SHELF_RUN_RENAMES,
  TEST_SHELF_RUN_TYPE_PATH,
  TEST_SHELF_RUN_VARIANTS,
  testShelfRunClassJson,
} from '../../game_entity/game_entity_test_class_enum_list.js';

/**
 * Builds a level with two shelf run volumes: one holding a list of categories
 * with an old name in it, one left at the class default.
 *
 * @param categories Categories of the first run.
 * @returns World and both runs.
 */
function levelWorldCreate(categories: string[]): {
  world: THREE.Group;
  listed: THREE.Object3D;
  defaulted: THREE.Object3D;
} {
  const world = new THREE.Group();
  const runCreate = (minimumX: number): THREE.Object3D => {
    const model = collisionTestModelCreate([
      {
        box: new THREE.Box3(new THREE.Vector3(minimumX, 0, 0), new THREE.Vector3(minimumX + 4, 2, 1)),
        operation: SolidOperation.Additive,
      },
    ]);
    world.add(model.root);
    return model.root;
  };
  const listed = runCreate(0);
  const defaulted = runCreate(6);
  GameEntityComponentStore.write(listed, { [TEST_SHELF_RUN_TYPE_PATH]: { [TEST_SHELF_RUN_LIST_PATH]: categories } });
  GameEntityComponentStore.write(defaulted, { [TEST_SHELF_RUN_TYPE_PATH]: {} });
  world.updateMatrixWorld(true);
  return { world, listed, defaulted };
}

/**
 * Returns the categories the collision document gives the pieces of one object.
 *
 * @param collision Collision document.
 * @param objectId Object id.
 * @returns Categories of each piece of the object.
 */
function pieceCategories(collision: CollisionDocument, objectId: string): unknown[] {
  return collision.pieces
    .filter((piece) => piece.object_id === objectId)
    .map((piece) => piece.components[TEST_SHELF_RUN_TYPE_PATH]?.[TEST_SHELF_RUN_LIST_PATH]);
}

let project: LevelExportTestProject | null = null;

afterEach(() => {
  if (project) levelExportTestProjectRemove(project);
  project = null;
});

/**
 * The command-line export reads enum list fields from the project's class file
 * and writes each list into the collision document as an ordered array of
 * current names.
 */
describe('LevelExportRunner enum lists', () => {
  it('writes the ordered list with old names renamed, and the default list where none is set', async () => {
    const [oldName = '', newName = ''] = Object.entries(TEST_SHELF_RUN_RENAMES)[0] ?? [];
    const others = TEST_SHELF_RUN_VARIANTS.filter((variant) => variant !== newName).reverse();
    const stored = [others[0] ?? '', oldName, others[1] ?? ''];
    const level = levelWorldCreate(stored);
    const classJson = testShelfRunClassJson();
    project = levelExportTestProjectCreate(level.world, {}, [classJson]);
    const result = await LevelExportRunner.run({
      projectFile: project.projectFile,
      levelId: project.levelId,
      outDirectory: null,
      isCheck: false,
    });
    expect(result.ok).toBe(true);
    const collision = JSON.parse(
      readFileSync(join(project.levelDirectory, COLLISION_FILE_NAME), 'utf8'),
    ) as CollisionDocument;
    const listedPieces = pieceCategories(collision, level.listed.uuid);
    expect(listedPieces.length).toBeGreaterThan(0);
    listedPieces.forEach((categories) => expect(categories).toEqual([others[0], newName, others[1]]));
    const defaultList = (classJson['fields'] as Array<Record<string, unknown>>)[0]?.['default'];
    const defaultedPieces = pieceCategories(collision, level.defaulted.uuid);
    expect(defaultedPieces.length).toBeGreaterThan(0);
    defaultedPieces.forEach((categories) => expect(categories).toEqual(defaultList));
  });
});
