import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GameEntityClassVariantNames } from '@/game_entity/class/game_entity_class_variant_names.js';
import { GameEntityVisualVolumeRunColors } from '@/game_entity/visual/volume/game_entity_visual_volume_run_colors.js';
import {
  GAME_ENTITY_VOLUME_LABEL_SEPARATOR,
  GameEntityVisualVolumeSpecResolver,
} from '@/game_entity/visual/volume/game_entity_visual_volume_spec.js';
import { testClassesInstall } from '../../game_entity_test_classes.js';
import {
  TEST_AISLE_BLOCKED_PATH,
  TEST_AISLE_CATEGORIES_PATH,
  TEST_AISLE_CEREAL_COLOR,
  TEST_AISLE_CEREAL_LABEL,
  TEST_AISLE_NOTE_PATH,
  testAisleClassCreate,
  testAisleClassListCreate,
  testAisleMarkerKeys,
  testAisleOverridesWrite,
} from './game_entity_visual_volume_test_support.js';

/** Removes the installed test classes after each test. */
let uninstall: () => void = () => undefined;

/**
 * Installs the aisle class with the given marker keys.
 *
 * @param keys Volume marker keys of the class.
 */
function aisleInstall(keys: Record<string, string> = testAisleMarkerKeys()): void {
  uninstall = testClassesInstall(testAisleClassListCreate(testAisleClassCreate(keys))).uninstall;
}

/**
 * Creates an object carrying the aisle with the given overrides.
 *
 * @param overrides Aisle field overrides.
 * @returns Object.
 */
function aisleObjectCreate(overrides: Record<string, unknown>): THREE.Object3D {
  const object = new THREE.Mesh(new THREE.BoxGeometry(6, 2, 2));
  testAisleOverridesWrite(object, overrides);
  return object;
}

/**
 * The volume marker spec reads the label, hatching and runs an object's class
 * asks for from the object's effective field values.
 */
describe('GameEntityVisualVolumeSpecResolver', () => {
  afterEach(() => uninstall());

  it('labels the volume with the variant labels of its list joined in list order', () => {
    aisleInstall();
    const categories = ['tins', 'cereal', 'bottles'];
    const spec = GameEntityVisualVolumeSpecResolver.specOf(
      aisleObjectCreate({ [TEST_AISLE_CATEGORIES_PATH]: categories }),
    );
    const aisle = testAisleClassCreate();
    const field = aisle.fields.find((candidate) => candidate.path === TEST_AISLE_CATEGORIES_PATH);
    const expected = categories.map((variant) =>
      field ? GameEntityClassVariantNames.labelOf(field, variant) : variant,
    );
    expect(expected).toContain(TEST_AISLE_CEREAL_LABEL);
    expect(spec?.labelText).toBe(expected.join(GAME_ENTITY_VOLUME_LABEL_SEPARATOR));
  });

  it('gives one run per list entry in order, with the variant label and color', () => {
    aisleInstall();
    const categories = ['cereal', 'bottles', 'tins'];
    const spec = GameEntityVisualVolumeSpecResolver.specOf(
      aisleObjectCreate({ [TEST_AISLE_CATEGORIES_PATH]: categories }),
    );
    expect(spec?.runs.map((run) => run.variantId)).toEqual(categories);
    expect(spec?.runs[0]?.label).toBe(TEST_AISLE_CEREAL_LABEL);
    expect(spec?.runs[0]?.colorHex).toBe(GameEntityVisualVolumeRunColors.srgbHexOf(TEST_AISLE_CEREAL_COLOR));
  });

  it('colors variants without their own color in distinct shades of the marker color', () => {
    aisleInstall();
    const categories = ['bottles', 'tins', 'storage'];
    const spec = GameEntityVisualVolumeSpecResolver.specOf(
      aisleObjectCreate({ [TEST_AISLE_CATEGORIES_PATH]: categories }),
    );
    const colors = spec?.runs.map((run) => run.colorHex) ?? [];
    expect(new Set(colors).size).toBe(categories.length);
    expect(colors[0]).toBe(GameEntityVisualVolumeRunColors.shadeOf(spec?.markerColorHex ?? 0, 0));
  });

  it('uses the class default list when the object does not override it', () => {
    aisleInstall();
    const spec = GameEntityVisualVolumeSpecResolver.specOf(aisleObjectCreate({}));
    const field = testAisleClassCreate().fields.find((candidate) => candidate.path === TEST_AISLE_CATEGORIES_PATH);
    expect(spec?.runs.map((run) => run.variantId)).toEqual(field?.default);
  });

  it('hatches the volume exactly while the named bool field holds true', () => {
    aisleInstall();
    expect(GameEntityVisualVolumeSpecResolver.specOf(aisleObjectCreate({}))?.isHatched).toBe(false);
    const blocked = aisleObjectCreate({ [TEST_AISLE_BLOCKED_PATH]: true });
    expect(GameEntityVisualVolumeSpecResolver.specOf(blocked)?.isHatched).toBe(true);
  });

  it('writes a non-list label field as its text', () => {
    aisleInstall({ marker_label_field: TEST_AISLE_NOTE_PATH });
    const spec = GameEntityVisualVolumeSpecResolver.specOf(aisleObjectCreate({ [TEST_AISLE_NOTE_PATH]: 'back wall' }));
    expect(spec?.labelText).toBe('back wall');
    expect(spec?.runs).toEqual([]);
    expect(spec?.isHatched).toBe(false);
  });

  it('draws no volume marker for classes without the keys or with unknown field paths', () => {
    aisleInstall({});
    expect(GameEntityVisualVolumeSpecResolver.specOf(aisleObjectCreate({}))).toBeNull();
    uninstall();
    aisleInstall({ marker_runs_field: 'missing', marker_hatched_when_true: TEST_AISLE_CATEGORIES_PATH });
    const spec = GameEntityVisualVolumeSpecResolver.specOf(aisleObjectCreate({}));
    expect(spec?.runs).toEqual([]);
    expect(spec?.isHatched).toBe(false);
    expect(spec?.labelText).toBeNull();
  });
});
