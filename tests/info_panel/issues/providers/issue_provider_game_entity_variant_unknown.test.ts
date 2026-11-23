import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { GameEntityClass } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { IssueProviderGameEntityVariantUnknown } from '@/info_panel/issues/providers/issue_provider_game_entity_variant_unknown.js';
import {
  testClassesInstall,
  testClassListCreate,
  testDoorClassCreate,
} from '../../../game_entity/game_entity_test_classes.js';
import {
  TEST_SHELF_RUN_LIST_PATH,
  TEST_SHELF_RUN_TYPE_PATH,
  TEST_SHELF_RUN_VARIANTS,
  testShelfRunClassCreate,
} from '../../../game_entity/game_entity_test_class_enum_list.js';

/**
 * Returns the test door picking its marker by its kind field, with a box for
 * the iron kind.
 *
 * @returns Door class.
 */
function doorClassPickingByKind(): GameEntityClass {
  return {
    ...testDoorClassCreate(),
    marker_box: { size: [1, 2, 0.2], offset: [0, 1, 0] },
    marker_box_field: 'kind',
    marker_boxes: { Iron: { size: [3, 2.5, 0.4], offset: [0, 1.25, 0], model: 'models/iron_door.glb' } },
  };
}

/**
 * Objects whose marker field holds a value the enum does not list, such as a
 * renamed fixture id, are reported on the object with the value.
 */
describe('IssueProviderGameEntityVariantUnknown', () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
  });

  it('reports an object whose kind is no longer one of the listed kinds, naming the value', () => {
    const door = doorClassPickingByKind();
    const list = testClassListCreate();
    list.classes = [door];
    cleanups.push(testClassesInstall(list).uninstall);
    const world = new THREE.Group();
    const renamed = new THREE.Object3D();
    renamed.name = 'Old door';
    const listed = new THREE.Object3D();
    world.add(renamed, listed);
    const removedKind = `Bronze${Math.floor(Math.random() * 1000)}`;
    GameEntityComponentStore.write(renamed, { [door.type_path]: { kind: removedKind } });
    GameEntityComponentStore.write(listed, { [door.type_path]: { kind: 'Glass' } });
    const issues = new IssueProviderGameEntityVariantUnknown().collect(world);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe('warning');
    expect(issues[0]?.objectUuid).toBe(renamed.uuid);
    expect(issues[0]?.objectName).toBe(renamed.name);
    expect(issues[0]?.description).toContain(removedKind);
  });
});

/**
 * Every entry of an enum list field the field does not list is reported on the
 * object with the value, in list order.
 */
describe('IssueProviderGameEntityVariantUnknown enum lists', () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
  });

  it('reports each unlisted entry of an object, naming the value, and nothing for listed entries', () => {
    const shelfRun = testShelfRunClassCreate();
    const list = testClassListCreate();
    list.classes = [shelfRun];
    cleanups.push(testClassesInstall(list).uninstall);
    const world = new THREE.Group();
    const stale = new THREE.Object3D();
    stale.name = 'Aisle 3';
    const current = new THREE.Object3D();
    world.add(stale, current);
    const dropped = [`dropped-${Math.floor(Math.random() * 1000)}`, 'also-dropped'];
    const [listed = ''] = TEST_SHELF_RUN_VARIANTS;
    GameEntityComponentStore.write(stale, {
      [TEST_SHELF_RUN_TYPE_PATH]: { [TEST_SHELF_RUN_LIST_PATH]: [dropped[0] ?? '', listed, dropped[1] ?? ''] },
    });
    GameEntityComponentStore.write(current, { [TEST_SHELF_RUN_TYPE_PATH]: { [TEST_SHELF_RUN_LIST_PATH]: [listed] } });
    const issues = new IssueProviderGameEntityVariantUnknown().collect(world);
    expect(issues.map((issue) => issue.objectUuid)).toEqual([stale.uuid, stale.uuid]);
    expect(issues.every((issue) => issue.objectName === stale.name && issue.severity === 'warning')).toBe(true);
    dropped.forEach((value, index) => expect(issues[index]?.description).toContain(value));
  });
});
