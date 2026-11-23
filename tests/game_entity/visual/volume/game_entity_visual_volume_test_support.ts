import * as THREE from 'three';
import { gameEntityClassFromUnknown, type GameEntityClass } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { SolidBrushVisual } from '@/solid/model/solid_brush_visual.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';
import { testClassListCreate } from '../../game_entity_test_classes.js';

/** Type path of the test aisle volume class. */
export const TEST_AISLE_TYPE_PATH = 'test_game::store::Aisle';

/** Path of the aisle's list of categories. */
export const TEST_AISLE_CATEGORIES_PATH = 'categories';

/** Path of the aisle's blocked flag. */
export const TEST_AISLE_BLOCKED_PATH = 'blocked';

/** Path of the aisle's plain text note. */
export const TEST_AISLE_NOTE_PATH = 'note';

/** Display label and band color of the one category the class names fully. */
export const TEST_AISLE_CEREAL_LABEL = 'Cereal';
export const TEST_AISLE_CEREAL_COLOR: [number, number, number] = [0.85, 0.6, 0.2];

/**
 * Returns the aisle class as a class file declares it: a volume labelled and
 * banded by its ordered categories and hatched while blocked.
 *
 * @param keys Volume marker keys; all three by default.
 * @returns Untrusted class record.
 */
export function testAisleClassJson(keys: Record<string, string> = testAisleMarkerKeys()): Record<string, unknown> {
  return {
    type_path: TEST_AISLE_TYPE_PATH,
    label: 'Aisle',
    category: 'Store',
    placement: 'any',
    collision: 'volume',
    marker_color: [0.3, 0.55, 0.9],
    ...keys,
    fields: [
      {
        path: TEST_AISLE_CATEGORIES_PATH,
        label: 'Categories',
        kind: 'enum_list',
        default: ['generic'],
        variants: ['bottles', 'cereal', 'generic', 'storage', 'tins'],
        variant_details: {
          cereal: { label: TEST_AISLE_CEREAL_LABEL, group: 'Dry goods', color: [...TEST_AISLE_CEREAL_COLOR] },
        },
      },
      { path: TEST_AISLE_BLOCKED_PATH, label: 'Blocked off', kind: 'bool', default: false },
      { path: TEST_AISLE_NOTE_PATH, label: 'Note', kind: 'text', default: 'front' },
    ],
  };
}

/**
 * Returns the three volume marker keys the aisle class names.
 *
 * @returns Keys by name.
 */
export function testAisleMarkerKeys(): Record<string, string> {
  return {
    marker_label_field: TEST_AISLE_CATEGORIES_PATH,
    marker_hatched_when_true: TEST_AISLE_BLOCKED_PATH,
    marker_runs_field: TEST_AISLE_CATEGORIES_PATH,
  };
}

/**
 * Returns the aisle class as the editor reads it.
 *
 * @param keys Volume marker keys; all three by default.
 * @returns Class.
 * @throws Error when the class does not read.
 */
export function testAisleClassCreate(keys: Record<string, string> = testAisleMarkerKeys()): GameEntityClass {
  const gameClass = gameEntityClassFromUnknown(testAisleClassJson(keys));
  if (gameClass === null) {
    throw new Error('the aisle class reads');
  }
  return gameClass;
}

/**
 * Returns the test class list with the aisle class added.
 *
 * @param aisle Aisle class to add.
 * @returns Class list.
 */
export function testAisleClassListCreate(aisle: GameEntityClass = testAisleClassCreate()) {
  const list = testClassListCreate();
  return { ...list, classes: [...list.classes, aisle] };
}

/**
 * Creates a box brush of the given size carrying an aisle component with the
 * given overrides.
 *
 * @param size Edge lengths of the box.
 * @param overrides Aisle field overrides.
 * @returns Brush mesh.
 */
export function testAisleBrushCreate(size: THREE.Vector3, overrides: Record<string, unknown>): THREE.Mesh {
  const brush = SolidBrushVisual.createBoxPreview('Aisle', size, SolidOperation.Additive);
  testAisleOverridesWrite(brush, overrides);
  return brush;
}

/**
 * Replaces the aisle overrides of an object.
 *
 * @param object Object carrying the aisle.
 * @param overrides Aisle field overrides.
 */
export function testAisleOverridesWrite(object: THREE.Object3D, overrides: Record<string, unknown>): void {
  GameEntityComponentStore.write(object, {
    [TEST_AISLE_TYPE_PATH]: overrides as Record<string, string>,
  });
}
