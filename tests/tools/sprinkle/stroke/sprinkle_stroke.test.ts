import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { GameEntityOwner } from '@/game_entity/owner/game_entity_owner.js';
import { SprinkleBrushVolume } from '@/tools/sprinkle/brush/sprinkle_brush_volume.js';
import { SprinkleGridCellEnumerator } from '@/tools/sprinkle/grid/sprinkle_grid_cell_enumerator.js';
import { SprinkleGridLayout } from '@/tools/sprinkle/grid/sprinkle_grid_layout.js';
import { SprinkleMark } from '@/tools/sprinkle/mark/sprinkle_mark.js';
import { StateSprinkleTool } from '@/tools/sprinkle/state_sprinkle_tool.js';
import type { SprinkleConfig, SprinkleSurfaceHit } from '@/tools/sprinkle/sprinkle_types.js';
import type { SprinkleStroke } from '@/tools/sprinkle/stroke/sprinkle_stroke.js';
import {
  sprinkleStrokeCreate,
  sprinkleSurfaceProjectorCreate,
} from '@/tools/sprinkle/stroke/sprinkle_stroke_factory.js';
import type { SprinkleStrokeResult } from '@/tools/sprinkle/stroke/sprinkle_stroke_types.js';
import {
  SPRINKLE_TEST_CASE_COMPONENTS,
  SPRINKLE_TEST_DEFINITION_NAME,
  SPRINKLE_TEST_DOOR_CLASS_ID,
  sprinkleTestCaseCreate,
  sprinkleTestDefinitionCreate,
  sprinkleTestLibraryInstall,
  sprinkleTestSceneCreate,
  sprinkleTestTopHeightRead,
  type SprinkleTestScene,
} from '../sprinkle_test_support.js';

/** Center of the floor's top face in the stroke tests. */
const STROKE_TEST_FLOOR_CENTER = new THREE.Vector3(3.2, 1.5, -2.7);

/** Floor side length, much larger than the brush. */
const STROKE_TEST_FLOOR_SIZE = 40;

/** Brush radius of the stroke tests. */
const STROKE_TEST_RADIUS = 3;

/**
 * Returns the test configuration with overrides.
 *
 * @param patch Fields to override.
 * @returns Configuration naming the test definition.
 */
function strokeTestConfig(patch: Partial<SprinkleConfig> = {}): SprinkleConfig {
  return {
    ...StateSprinkleTool.configDefaultCreate(),
    definitionName: SPRINKLE_TEST_DEFINITION_NAME,
    radius: STROKE_TEST_RADIUS,
    densityPercent: 100,
    ...patch,
  };
}

/**
 * Starts a stroke over a scene.
 *
 * @param scene Test scene.
 * @param config Stroke configuration.
 * @returns The stroke.
 */
function strokeTestStart(scene: SprinkleTestScene, config: SprinkleConfig): SprinkleStroke {
  const projector = sprinkleSurfaceProjectorCreate(scene.services);
  const created = sprinkleStrokeCreate(scene.services, projector, config, { mode: config.mode, seed: config.seed });
  if (!created.ok) throw new Error(created.message);
  return created.stroke;
}

/**
 * Runs a one-dab stroke at a surface hit.
 *
 * @param scene Test scene.
 * @param config Stroke configuration.
 * @param hit Brush center; the floor center facing up when omitted.
 * @returns Stroke result.
 */
function strokeTestStamp(
  scene: SprinkleTestScene,
  config: SprinkleConfig,
  hit: SprinkleSurfaceHit = strokeTestFloorHit(),
): SprinkleStrokeResult {
  const stroke = strokeTestStart(scene, config);
  stroke.dabApply(hit);
  return stroke.finish();
}

/**
 * Returns the floor's top center facing up.
 *
 * @param offset Shift from the floor center.
 * @returns Surface hit.
 */
function strokeTestFloorHit(offset: THREE.Vector3 = new THREE.Vector3()): SprinkleSurfaceHit {
  return { point: STROKE_TEST_FLOOR_CENTER.clone().add(offset), normal: new THREE.Vector3(0, 1, 0) };
}

/**
 * Counts the grid cells a dab at a hit visits with a configuration.
 *
 * @param config Stroke configuration.
 * @param hit Brush center.
 * @returns Number of cells whose centers lie in the radius.
 */
function strokeTestCellCount(config: SprinkleConfig, hit: SprinkleSurfaceHit = strokeTestFloorHit()): number {
  const volume = new SprinkleBrushVolume(hit, config.radius);
  const layout = SprinkleGridLayout.fromConfig(config, sprinkleTestDefinitionCreate());
  return SprinkleGridCellEnumerator.cellsInCircle(volume.plane, layout, volume.circleRead()).length;
}

/**
 * Returns the sprinkled entities of a scene.
 *
 * @param scene Test scene.
 * @returns Sprinkled entities.
 */
function strokeTestSprinkled(scene: SprinkleTestScene): THREE.Object3D[] {
  return SprinkleMark.objectsCollect(scene.world);
}

/**
 * Adds a hand-placed game entity at a world point.
 *
 * @param scene Test scene.
 * @param position World position.
 * @returns The entity.
 */
function strokeTestPlacedEntityAdd(scene: SprinkleTestScene, position: THREE.Vector3): THREE.Group {
  const entity = GameEntityOwner.createDefault('Hand placed');
  entity.position.copy(position);
  scene.world.add(entity);
  scene.world.updateMatrixWorld(true);
  return entity;
}

/**
 * Sprinkle strokes: mode decisions, density, visited cells, undo and
 * instantiation.
 */
describe('SprinkleStroke', () => {
  let scene: SprinkleTestScene;
  let uninstall: () => void = () => undefined;

  beforeEach(() => {
    uninstall = sprinkleTestLibraryInstall();
    scene = sprinkleTestSceneCreate(STROKE_TEST_FLOOR_CENTER, STROKE_TEST_FLOOR_SIZE);
  });

  afterEach(() => {
    uninstall();
  });

  it('fills every cell of the radius at density 100 with marked entities on the floor', () => {
    const config = strokeTestConfig();
    const result = strokeTestStamp(scene, config);
    const sprinkled = strokeTestSprinkled(scene);
    const floorTop = sprinkleTestTopHeightRead(scene.floor);
    expect(result).toEqual({ added: strokeTestCellCount(config), removed: 0 });
    expect(sprinkled.length).toBe(result.added);
    for (const entity of sprinkled) {
      const position = entity.getWorldPosition(new THREE.Vector3());
      expect(position.y).toBeCloseTo(floorTop, 6);
      expect(
        Math.hypot(position.x - STROKE_TEST_FLOOR_CENTER.x, position.z - STROKE_TEST_FLOOR_CENTER.z),
      ).toBeLessThanOrEqual(config.radius + 1e-9);
    }
  });

  it('gives placed entities the case class, component overrides and the mark', () => {
    strokeTestStamp(scene, strokeTestConfig());
    const sprinkled = strokeTestSprinkled(scene);
    expect(sprinkled.length).toBeGreaterThan(0);
    for (const entity of sprinkled) {
      expect(GameEntityOwner.isOwner(entity)).toBe(true);
      expect(SprinkleMark.read(entity)).toBe(SPRINKLE_TEST_DEFINITION_NAME);
      expect(GameEntityComponentStore.read(entity)).toEqual(SPRINKLE_TEST_CASE_COMPONENTS);
    }
  });

  it('places nothing and records no undo step at density 0', () => {
    const result = strokeTestStamp(scene, strokeTestConfig({ densityPercent: 0 }));
    expect(result).toEqual({ added: 0, removed: 0 });
    expect(scene.commandStack.canUndo()).toBe(false);
    expect(scene.mutationCount.value).toBe(0);
  });

  it('places about the density share of the cells', () => {
    const config = strokeTestConfig({ radius: 12, densityPercent: 30 });
    const result = strokeTestStamp(scene, config);
    expect(result.added / strokeTestCellCount(config)).toBeCloseTo(config.densityPercent / 100, 1);
  });

  it('visits every cell once per stroke so repeated dabs on the same spot add nothing', () => {
    const stroke = strokeTestStart(scene, strokeTestConfig({ densityPercent: 50 }));
    const firstDab = stroke.dabApply(strokeTestFloorHit());
    const repeatedDab = stroke.dabApply(strokeTestFloorHit());
    stroke.finish();
    expect(firstDab.added).toBeGreaterThan(0);
    expect(repeatedDab).toEqual({ added: 0, removed: 0 });
  });

  it('records a whole multi-dab stroke as one undo step that undo and redo restore', () => {
    const stroke = strokeTestStart(scene, strokeTestConfig());
    stroke.dabApply(strokeTestFloorHit());
    stroke.dabApply(strokeTestFloorHit(new THREE.Vector3(STROKE_TEST_RADIUS, 0, 0)));
    const result = stroke.finish();
    const placed = strokeTestSprinkled(scene);
    expect(scene.commandStack.getUndoCount()).toBe(1);
    expect(placed.length).toBe(result.added);
    scene.commandStack.undo();
    expect(strokeTestSprinkled(scene)).toEqual([]);
    scene.commandStack.redo();
    expect(new Set(strokeTestSprinkled(scene))).toEqual(new Set(placed));
  });

  it('replaces the entities of cells it places into in ADDITIVE mode', () => {
    const config = strokeTestConfig();
    const first = strokeTestStamp(scene, config);
    const firstEntities = new Set(strokeTestSprinkled(scene));
    const second = strokeTestStamp(scene, config);
    const secondEntities = strokeTestSprinkled(scene);
    expect(second).toEqual({ added: first.added, removed: first.added });
    expect(secondEntities.length).toBe(first.added);
    expect(secondEntities.some((entity) => firstEntities.has(entity))).toBe(false);
  });

  it('removes sprinkled entities in the radius only, never hand-placed ones, in SUBTRACTIVE mode', () => {
    const outside = strokeTestFloorHit(new THREE.Vector3(STROKE_TEST_RADIUS * 4, 0, 0));
    const outsideAdded = strokeTestStamp(scene, strokeTestConfig(), outside).added;
    const insideAdded = strokeTestStamp(scene, strokeTestConfig()).added;
    const handPlaced = strokeTestPlacedEntityAdd(scene, STROKE_TEST_FLOOR_CENTER);
    const result = strokeTestStamp(scene, strokeTestConfig({ mode: 'SUBTRACTIVE' }));
    expect(result).toEqual({ added: 0, removed: insideAdded });
    expect(strokeTestSprinkled(scene).length).toBe(outsideAdded);
    expect(handPlaced.parent).toBe(scene.world);
  });

  it('clears the radius then places in REPLACE mode', () => {
    const filled = strokeTestStamp(scene, strokeTestConfig()).added;
    const cleared = strokeTestStamp(scene, strokeTestConfig({ mode: 'REPLACE', densityPercent: 0 }));
    expect(cleared).toEqual({ added: 0, removed: filled });
    const refilled = strokeTestStamp(scene, strokeTestConfig({ mode: 'REPLACE' }));
    expect(refilled).toEqual({ added: filled, removed: 0 });
  });

  it('keeps what the same REPLACE stroke placed when dabs overlap', () => {
    const stroke = strokeTestStart(scene, strokeTestConfig({ mode: 'REPLACE' }));
    const firstDab = stroke.dabApply(strokeTestFloorHit());
    const overlappingDab = stroke.dabApply(strokeTestFloorHit(new THREE.Vector3(STROKE_TEST_RADIUS / 2, 0, 0)));
    stroke.finish();
    expect(overlappingDab.removed).toBe(0);
    expect(strokeTestSprinkled(scene).length).toBe(firstDab.added + overlappingDab.added);
  });

  it('places only into occupied cells in OVERWRITE mode', () => {
    expect(strokeTestStamp(scene, strokeTestConfig({ mode: 'OVERWRITE' }))).toEqual({ added: 0, removed: 0 });
    const partial = strokeTestStamp(scene, strokeTestConfig({ densityPercent: 40 })).added;
    const overwritten = strokeTestStamp(scene, strokeTestConfig({ mode: 'OVERWRITE', seed: 5 }));
    expect(partial).toBeGreaterThan(0);
    expect(overwritten).toEqual({ added: partial, removed: partial });
    expect(strokeTestSprinkled(scene).length).toBe(partial);
  });

  it('reports an unknown entity class once and places nothing', () => {
    uninstall();
    uninstall = sprinkleTestLibraryInstall([sprinkleTestDefinitionCreate([sprinkleTestCaseCreate('no.such.class')])]);
    const result = strokeTestStamp(scene, strokeTestConfig());
    expect(result.added).toBe(0);
    expect(scene.statusMessages.filter((message) => message.includes('no.such.class'))).toHaveLength(1);
  });

  it('never places a case without weight', () => {
    const cases = [sprinkleTestCaseCreate(SPRINKLE_TEST_DOOR_CLASS_ID, 1), sprinkleTestCaseCreate('no.such.class', 0)];
    uninstall();
    uninstall = sprinkleTestLibraryInstall([sprinkleTestDefinitionCreate(cases)]);
    expect(strokeTestStamp(scene, strokeTestConfig()).added).toBe(strokeTestCellCount(strokeTestConfig()));
    expect(scene.statusMessages).toEqual([]);
  });

  it('refuses grids too fine for the radius with a status message', () => {
    const config = strokeTestConfig({ radius: 200, gridSizeFromDefinition: false, gridSizeU: 0.05, gridSizeV: 0.05 });
    expect(strokeTestStamp(scene, config).added).toBe(0);
    expect(scene.statusMessages).toHaveLength(1);
  });

  it('paints walls on their own axis plane and tilts entities to the wall normal', () => {
    const wallNormal = new THREE.Vector3(1, 0, 0);
    const wallHit = { point: STROKE_TEST_FLOOR_CENTER.clone().add(new THREE.Vector3(-2, 4, 0)), normal: wallNormal };
    const wall = new THREE.Mesh(new THREE.BoxGeometry(1, 20, 20));
    wall.position.copy(wallHit.point).add(new THREE.Vector3(-0.5, 0, 0));
    scene.world.add(wall);
    scene.world.updateMatrixWorld(true);
    const result = strokeTestStamp(scene, strokeTestConfig({ radius: 1.5, alignToNormal: true }), wallHit);
    expect(result.added).toBe(strokeTestCellCount(strokeTestConfig({ radius: 1.5 }), wallHit));
    for (const entity of strokeTestSprinkled(scene)) {
      expect(entity.getWorldPosition(new THREE.Vector3()).x).toBeCloseTo(wallHit.point.x, 6);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(entity.getWorldQuaternion(new THREE.Quaternion()));
      expect(up.distanceTo(wallNormal)).toBeLessThan(1e-6);
    }
  });

  it('spins entities around their up axis with random yaw', () => {
    strokeTestStamp(scene, strokeTestConfig({ randomYaw: true }));
    const yaws = strokeTestSprinkled(scene).map((entity) =>
      new THREE.Euler().setFromQuaternion(entity.quaternion, 'YXZ'),
    );
    expect(yaws.every((euler) => Math.abs(euler.x) < 1e-9 && Math.abs(euler.z) < 1e-9)).toBe(true);
    expect(new Set(yaws.map((euler) => euler.y.toFixed(6))).size).toBeGreaterThan(1);
  });
});
