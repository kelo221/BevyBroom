import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { GameEntityClass } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { GameEntityModelLibrary } from '@/game_entity/model/game_entity_model_library.js';
import { gameEntityCreateForClass } from '@/game_entity/owner/game_entity_owner.js';
import { GameEntityVisualBuilder } from '@/game_entity/visual/game_entity_visual_builder.js';
import { GameEntityVisualMarkerModel } from '@/game_entity/visual/game_entity_visual_marker_model.js';
import { entityVisualPartIs } from '@/entity/model/entity_owner_keys.js';
import { shouldOmitFromExport } from '@/io/scene/export_object_omission.js';
import { isEditorHelperObject } from '@/utils/mesh_edge_sync.js';
import { testClassesInstall, testClassListCreate, testDoorClassCreate } from '../game_entity_test_classes.js';
import {
  gameEntityModelTestBase64,
  gameEntityModelTestGlbCreate,
  gameEntityModelTestReaderCreate,
  gameEntityModelTestSizeOf,
} from '../model/game_entity_model_test_files.js';

/** Model path of iron doors. */
const IRON_MODEL_PATH = 'models/iron_door.glb';

/** Model path of glass doors. */
const GLASS_MODEL_PATH = 'models/glass_door.glb';

/** Edge lengths of the iron door model. */
const IRON_MODEL_SIZE = new THREE.Vector3(3, 2.5, 0.4);

/** Edge lengths of the glass door model. */
const GLASS_MODEL_SIZE = new THREE.Vector3(1, 2, 0.1);

/**
 * Returns the test door class whose iron and glass kinds name models.
 *
 * @returns Door class with model marker boxes.
 */
function doorClassWithModels(): GameEntityClass {
  return {
    ...testDoorClassCreate(),
    marker_box_field: 'kind',
    marker_boxes: {
      Iron: { size: IRON_MODEL_SIZE.toArray(), offset: [0, 1.25, 0], model: IRON_MODEL_PATH },
      Glass: { size: GLASS_MODEL_SIZE.toArray(), offset: [0, 1, 0], model: GLASS_MODEL_PATH },
    },
  };
}

/**
 * Points the shared library at a reader serving both door models.
 *
 * @returns Paths the reader was asked for.
 */
async function sharedLibraryServe(): Promise<string[]> {
  const files = new Map([
    [IRON_MODEL_PATH, gameEntityModelTestBase64(await gameEntityModelTestGlbCreate(IRON_MODEL_SIZE))],
    [GLASS_MODEL_PATH, gameEntityModelTestBase64(await gameEntityModelTestGlbCreate(GLASS_MODEL_SIZE))],
  ]);
  const { reader, reads } = gameEntityModelTestReaderCreate(files);
  GameEntityModelLibrary.shared.readerSet(reader);
  return reads;
}

/**
 * Creates a door entity of one kind and refreshes its marker until its model
 * had the chance to load.
 *
 * @param kind Door kind.
 * @returns Door owner.
 */
async function doorWithModelCreate(kind: string): Promise<THREE.Group> {
  const door = doorClassWithModels();
  const owner = gameEntityCreateForClass(door, { [door.type_path]: { kind } });
  GameEntityVisualBuilder.refresh(owner);
  await GameEntityModelLibrary.shared.idle();
  GameEntityVisualBuilder.refresh(owner);
  return owner;
}

/**
 * Expects a drawn model to fill a marker box exactly in its owner's space.
 *
 * @param owner Game entity owner.
 * @param model Drawn model.
 * @param markerBox Box the model should fill.
 */
function expectModelFillsBox(
  owner: THREE.Object3D,
  model: THREE.Object3D,
  markerBox: { size: [number, number, number]; offset: [number, number, number] } | undefined,
): void {
  if (markerBox === undefined) {
    throw new Error('the marker box exists');
  }
  owner.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model).applyMatrix4(owner.matrixWorld.clone().invert());
  const expected = new THREE.Box3().setFromCenterAndSize(
    new THREE.Vector3(...markerBox.offset),
    new THREE.Vector3(...markerBox.size),
  );
  expect(bounds.min.distanceTo(expected.min)).toBeLessThan(1e-5);
  expect(bounds.max.distanceTo(expected.max)).toBeLessThan(1e-5);
}

/**
 * A game entity whose marker box names a model draws that model at its origin
 * as an editor-only part, and follows the field that picks the box.
 */
describe('GameEntityVisualMarkerModel', () => {
  const cleanups: (() => void)[] = [];

  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
    GameEntityModelLibrary.shared.readerSet(null);
  });

  /** Installs the door class with models in place of the plain test door. */
  function doorClassInstall(): void {
    const list = testClassListCreate();
    list.classes = [doorClassWithModels()];
    cleanups.push(testClassesInstall(list).uninstall);
  }

  it('draws the model of the picked box filling its box once it is loaded', async () => {
    doorClassInstall();
    await sharedLibraryServe();
    const owner = await doorWithModelCreate('Iron');
    const model = GameEntityVisualMarkerModel.find(owner);
    if (model === null) {
      throw new Error('the iron door draws its model');
    }
    expect(gameEntityModelTestSizeOf(model).distanceTo(IRON_MODEL_SIZE)).toBeLessThan(1e-5);
    expectModelFillsBox(owner, model, doorClassWithModels().marker_boxes?.['Iron']);
  });

  it('stretches a model per axis to fill a box of another size, footprint centred and bottom on the floor', async () => {
    const door = doorClassWithModels();
    const gridBox = {
      size: [3.25, 2.625, 0.5] as [number, number, number],
      offset: [0, 1.3125, 0] as [number, number, number],
    };
    door.marker_boxes = { ...door.marker_boxes, Iron: { ...gridBox, model: IRON_MODEL_PATH } };
    const list = testClassListCreate();
    list.classes = [door];
    cleanups.push(testClassesInstall(list).uninstall);
    await sharedLibraryServe();
    const owner = await doorWithModelCreate('Iron');
    const model = GameEntityVisualMarkerModel.find(owner);
    if (model === null) {
      throw new Error('the iron door draws its model');
    }
    expectModelFillsBox(owner, model, gridBox);
  });

  it('keeps the model out of picking, saving and export', async () => {
    doorClassInstall();
    await sharedLibraryServe();
    const owner = await doorWithModelCreate('Iron');
    const parts: THREE.Object3D[] = [];
    GameEntityVisualMarkerModel.find(owner)?.traverse((part) => parts.push(part));
    expect(parts.length).toBeGreaterThan(1);
    parts.forEach((part) => {
      expect(entityVisualPartIs(part)).toBe(true);
      expect(isEditorHelperObject(part)).toBe(true);
      expect(shouldOmitFromExport(part)).toBe(true);
    });
  });

  it('swaps the model when the field picks another box and drops it for a box without one', async () => {
    doorClassInstall();
    await sharedLibraryServe();
    const door = doorClassWithModels();
    const owner = await doorWithModelCreate('Iron');
    GameEntityComponentStore.write(owner, { [door.type_path]: { kind: 'Glass' } });
    GameEntityVisualBuilder.refresh(owner);
    await GameEntityModelLibrary.shared.idle();
    GameEntityVisualBuilder.refresh(owner);
    const glassModel = GameEntityVisualMarkerModel.find(owner) ?? new THREE.Group();
    expect(gameEntityModelTestSizeOf(glassModel).distanceTo(GLASS_MODEL_SIZE)).toBeLessThan(1e-5);
    GameEntityComponentStore.write(owner, { [door.type_path]: { kind: 'Wooden' } });
    GameEntityVisualBuilder.refresh(owner);
    expect(GameEntityVisualMarkerModel.find(owner)).toBeNull();
  });

  it('gives every entity its own materials so tinting one leaves the others alone', async () => {
    doorClassInstall();
    await sharedLibraryServe();
    const first = await doorWithModelCreate('Iron');
    const second = await doorWithModelCreate('Iron');
    const materialOf = (owner: THREE.Object3D): THREE.Material | null => {
      let found: THREE.Material | null = null;
      GameEntityVisualMarkerModel.find(owner)?.traverse((part) => {
        if (part instanceof THREE.Mesh && !Array.isArray(part.material)) found = part.material;
      });
      return found;
    };
    expect(materialOf(first)).not.toBeNull();
    expect(materialOf(first)).not.toBe(materialOf(second));
  });

  it('reads each model once for many entities', async () => {
    doorClassInstall();
    const reads = await sharedLibraryServe();
    await doorWithModelCreate('Iron');
    await doorWithModelCreate('Iron');
    expect(reads).toEqual([IRON_MODEL_PATH]);
  });
});
