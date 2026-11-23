import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GameEntityClassProviderProject } from '@/game_entity/class/game_entity_class_provider_project.js';
import { GameEntityClassProviderScene } from '@/game_entity/class/game_entity_class_provider_scene.js';
import { gameEntityClassListEmpty } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { GameEntityComponentValueList } from '@/game_entity/component/game_entity_component_value_list.js';
import { GameEntityComponentsEdit } from '@/game_entity/component/game_entity_components_edit.js';
import { IssueProviderGameComponentRewrites } from '@/info_panel/issues/providers/issue_provider_game_component_rewrites.js';
import type { SceneJSON } from '@/io/scene/io_types.js';
import { SceneDeserializer } from '@/io/scene/scene_deserializer.js';
import { SceneSerializer } from '@/io/scene/scene_serializer.js';
import { PreviewStateObjectCollector } from '@/preview/state/preview_state_object_collector.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';
import { collisionTestModelCreate } from '../../level_export/collision/collision_test_models.js';
import {
  TEST_SHELF_RUN_LIST_PATH,
  TEST_SHELF_RUN_RENAMES,
  TEST_SHELF_RUN_TYPE_PATH,
  TEST_SHELF_RUN_VARIANTS,
  testShelfRunClassCreate,
} from '../game_entity_test_class_enum_list.js';

/** Makes the shelf run the class the project's class file declares. */
function projectClassesWrite(): void {
  GameEntityClassProviderProject.shared.listWrite({
    ...gameEntityClassListEmpty(),
    classes: [testShelfRunClassCreate()],
  });
}

/**
 * Builds a world with one box brush carrying the shelf run with a list of
 * categories.
 *
 * @param categories Categories the run holds.
 * @returns World and the brush root.
 */
function worldWithRunCreate(categories: string[]): { world: THREE.Group; run: THREE.Object3D } {
  const world = new THREE.Group();
  const model = collisionTestModelCreate([
    {
      box: new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(6, 2, 2)),
      operation: SolidOperation.Additive,
    },
  ]);
  const listField = testShelfRunClassCreate().fields.find((field) => field.path === TEST_SHELF_RUN_LIST_PATH);
  if (!listField) {
    throw new Error('the shelf run has its list field');
  }
  const components = GameEntityComponentsEdit.fieldSet({}, TEST_SHELF_RUN_TYPE_PATH, listField, categories);
  GameEntityComponentStore.write(model.root, components);
  world.add(model.root);
  return { world, run: model.root };
}

/**
 * Loads a scene file into a fresh world through JSON text.
 *
 * @param scene Scene file content.
 * @returns Loaded world.
 */
function sceneLoad(scene: SceneJSON): THREE.Group {
  const world = new THREE.Group();
  new SceneDeserializer().deserialize(JSON.parse(JSON.stringify(scene)) as SceneJSON, world);
  return world;
}

/**
 * Returns the categories an object of a loaded world holds.
 *
 * @param world Loaded world.
 * @param uuid Object id.
 * @returns Stored categories.
 */
function categoriesOf(world: THREE.Group, uuid: string): unknown {
  const object = world.getObjectByProperty('uuid', uuid);
  return object === undefined
    ? null
    : GameEntityComponentStore.read(object)[TEST_SHELF_RUN_TYPE_PATH]?.[TEST_SHELF_RUN_LIST_PATH];
}

/**
 * Enum list values save, load and reach the game preview in their order, and
 * old entries take their new names when a level opens.
 */
describe('enum list fields in levels', () => {
  afterEach(() => {
    GameEntityClassProviderProject.shared.listWrite(gameEntityClassListEmpty());
    GameEntityClassProviderScene.shared.listWrite(gameEntityClassListEmpty());
  });

  it('saves and loads a run’s categories in their order and sends them to the game preview', () => {
    projectClassesWrite();
    const categories = [...TEST_SHELF_RUN_VARIANTS].reverse().slice(0, 3);
    const { world, run } = worldWithRunCreate(categories);
    expect(categoriesOf(world, run.uuid)).toEqual(categories);
    const loaded = sceneLoad(new SceneSerializer().serialize(world));
    expect(categoriesOf(loaded, run.uuid)).toEqual(categories);
    const sent = PreviewStateObjectCollector.collect(loaded).find((object) => object.id === run.uuid);
    expect(sent?.components?.[TEST_SHELF_RUN_TYPE_PATH]?.[TEST_SHELF_RUN_LIST_PATH]).toEqual(categories);
  });

  it('renames old entries on load, keeps their order and names the rewrite in the Issues list', () => {
    const [oldName = '', newName = ''] = Object.entries(TEST_SHELF_RUN_RENAMES)[0] ?? [];
    const kept = TEST_SHELF_RUN_VARIANTS.find((variant) => variant !== newName) ?? '';
    const world = new THREE.Group();
    const run = new THREE.Group();
    GameEntityComponentStore.write(run, {
      [TEST_SHELF_RUN_TYPE_PATH]: { [TEST_SHELF_RUN_LIST_PATH]: [kept, oldName] },
    });
    world.add(run);
    const scene = new SceneSerializer().serialize(world);
    projectClassesWrite();
    const loaded = sceneLoad(scene);
    expect(categoriesOf(loaded, run.uuid)).toEqual([kept, newName]);
    const issues = new IssueProviderGameComponentRewrites().collect(loaded);
    expect(issues.some((issue) => issue.objectUuid === run.uuid && issue.description.includes(newName))).toBe(true);
    const loadedRun = loaded.getObjectByProperty('uuid', run.uuid);
    const listField = testShelfRunClassCreate().fields[0];
    expect(
      loadedRun && listField
        ? GameEntityComponentValueList.variantsEffective(
            GameEntityComponentStore.read(loadedRun),
            TEST_SHELF_RUN_TYPE_PATH,
            listField,
          )
        : null,
    ).toEqual([kept, newName]);
  });
});
