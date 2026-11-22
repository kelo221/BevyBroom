import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { EntityVisualBillboard } from '@/entity/visual/entity_visual_billboard.js';
import type { GameEntityClass } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { GameEntityModelLibrary } from '@/game_entity/model/game_entity_model_library.js';
import { GameEntityOwner, gameEntityCreateForClass } from '@/game_entity/owner/game_entity_owner.js';
import { GameEntityVisualBuilder } from '@/game_entity/visual/game_entity_visual_builder.js';
import {
  GAME_ENTITY_MARKER_DIMMED_OPACITY,
  GameEntityVisualMarkerDim,
} from '@/game_entity/visual/game_entity_visual_marker_dim.js';
import { GameEntityVisualMarkerModel } from '@/game_entity/visual/game_entity_visual_marker_model.js';
import { testClassesInstall, testClassListCreate, testDoorClassCreate } from '../game_entity_test_classes.js';
import {
  gameEntityModelTestBase64,
  gameEntityModelTestGlbCreate,
  gameEntityModelTestReaderCreate,
} from '../model/game_entity_model_test_files.js';

/** Path of the field that dims the marker while false. */
const DIMMING_FIELD_PATH = 'stocked';

/** Model the test shelf's marker box names. */
const SHELF_MODEL_PATH = 'models/shelf.glb';

/**
 * Returns the test door class with an extra bool field, on by default, that
 * dims the marker while it is off, and a marker box naming a model.
 *
 * @returns Class with a dimming field.
 */
function shelfClassCreate(): GameEntityClass {
  const door = testDoorClassCreate();
  return {
    ...door,
    marker_box: { size: [2, 1, 0.5], offset: [0, 0.5, 0], model: SHELF_MODEL_PATH },
    fields: [
      ...door.fields,
      { path: DIMMING_FIELD_PATH, label: 'Stocked', kind: 'bool', default: true, marker_dimmed_when_false: true },
    ],
  };
}

/**
 * Creates a shelf entity with the given overrides and refreshes its marker
 * until the model had the chance to load.
 *
 * @param overrides Field overrides of the shelf component.
 * @returns Shelf owner.
 */
async function shelfCreate(overrides: Record<string, boolean>): Promise<THREE.Group> {
  const shelf = shelfClassCreate();
  const owner = gameEntityCreateForClass(shelf, { [shelf.type_path]: overrides });
  GameEntityVisualBuilder.refresh(owner);
  await GameEntityModelLibrary.shared.idle();
  GameEntityVisualBuilder.refresh(owner);
  return owner;
}

/**
 * Returns the opacity of the marker edges, icon and every model material.
 *
 * @param owner Game entity owner.
 * @returns Opacities of the drawn parts.
 */
function opacitiesRead(owner: THREE.Object3D): { edges: number; icon: number; model: number[] } {
  const marker = GameEntityOwner.markerOf(owner);
  const edges = marker?.children.find((child) => child instanceof THREE.LineSegments) as THREE.LineSegments;
  const icon = EntityVisualBillboard.iconFind(owner);
  const model: number[] = [];
  GameEntityVisualMarkerModel.find(owner)?.traverse((part) => {
    if (part instanceof THREE.Mesh) {
      model.push((part.material as THREE.Material).opacity);
    }
  });
  return {
    edges: (edges.material as THREE.Material).opacity,
    icon: (icon?.material as THREE.Material).opacity,
    model,
  };
}

/**
 * A bool field a class marks with `marker_dimmed_when_false` dims the marker,
 * icon and model of every placement whose value is false.
 */
describe('GameEntityVisualMarkerDim', () => {
  const cleanups: (() => void)[] = [];

  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
    GameEntityModelLibrary.shared.readerSet(null);
  });

  /** Installs the shelf class and serves its model. */
  async function shelfClassInstall(): Promise<void> {
    const list = testClassListCreate();
    list.classes = [shelfClassCreate()];
    cleanups.push(testClassesInstall(list).uninstall);
    const modelFile = gameEntityModelTestBase64(await gameEntityModelTestGlbCreate(new THREE.Vector3(2, 1, 0.5)));
    GameEntityModelLibrary.shared.readerSet(
      gameEntityModelTestReaderCreate(new Map([[SHELF_MODEL_PATH, modelFile]])).reader,
    );
  }

  it('dims only while the dimming field is false, the default being on', async () => {
    await shelfClassInstall();
    expect(GameEntityVisualMarkerDim.isDimmed(await shelfCreate({}))).toBe(false);
    expect(GameEntityVisualMarkerDim.isDimmed(await shelfCreate({ [DIMMING_FIELD_PATH]: true }))).toBe(false);
    expect(GameEntityVisualMarkerDim.isDimmed(await shelfCreate({ [DIMMING_FIELD_PATH]: false }))).toBe(true);
  });

  it('ignores bool fields without the flag', async () => {
    await shelfClassInstall();
    expect(GameEntityVisualMarkerDim.isDimmed(await shelfCreate({ locked: false }))).toBe(false);
  });

  it('draws marker, icon and model dimmed and restores them when switched on again', async () => {
    await shelfClassInstall();
    const owner = await shelfCreate({});
    const lit = opacitiesRead(owner);
    expect(lit.model.length).toBeGreaterThan(0);
    const shelfTypePath = shelfClassCreate().type_path;
    GameEntityComponentStore.write(owner, { [shelfTypePath]: { [DIMMING_FIELD_PATH]: false } });
    GameEntityVisualBuilder.refresh(owner);
    const dimmed = opacitiesRead(owner);
    expect(dimmed.edges).toBeCloseTo(lit.edges * GAME_ENTITY_MARKER_DIMMED_OPACITY, 6);
    expect(dimmed.icon).toBeCloseTo(lit.icon * GAME_ENTITY_MARKER_DIMMED_OPACITY, 6);
    dimmed.model.forEach((opacity, index) => {
      expect(opacity).toBeCloseTo((lit.model[index] ?? 1) * GAME_ENTITY_MARKER_DIMMED_OPACITY, 6);
    });
    GameEntityComponentStore.write(owner, { [shelfTypePath]: {} });
    GameEntityVisualBuilder.refresh(owner);
    expect(opacitiesRead(owner)).toEqual(lit);
  });
});
