import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { EntityClassRegistry } from '@/entity/class/registry/entity_class_registry.js';
import { SprinkleDefinitionBuilder } from '@/tools/sprinkle/definition/builder/sprinkle_definition_builder.js';
import { SprinkleDefinitionBuiltin } from '@/tools/sprinkle/definition/builtin/sprinkle_definition_builtin.js';
import {
  SPRINKLE_DEFINITION_BUILTIN_FILES,
  SPRINKLE_DEFINITION_BUILTIN_PATH_PREFIX,
} from '@/tools/sprinkle/definition/builtin/sprinkle_definition_builtin_files.js';
import type { SprinkleDefinition } from '@/tools/sprinkle/definition/sprinkle_definition.js';
import { SprinkleMark } from '@/tools/sprinkle/mark/sprinkle_mark.js';
import { SprinkleEntityFactory } from '@/tools/sprinkle/placement/sprinkle_entity_factory.js';
import { StateSprinkleTool } from '@/tools/sprinkle/state_sprinkle_tool.js';
import {
  sprinkleStrokeCreate,
  sprinkleSurfaceProjectorCreate,
} from '@/tools/sprinkle/stroke/sprinkle_stroke_factory.js';
import type { SprinkleStrokeResult } from '@/tools/sprinkle/stroke/sprinkle_stroke_types.js';
import {
  sprinkleTestLibraryInstall,
  sprinkleTestSceneCreate,
  type SprinkleTestScene,
} from '../../sprinkle_test_support.js';

/** Center of the floor's top face the built-in definitions are painted on. */
const BUILTIN_TEST_FLOOR_CENTER = new THREE.Vector3(-1.7, 0.6, 2.3);

/** Floor side length, much larger than the brush. */
const BUILTIN_TEST_FLOOR_SIZE = 60;

/** Brush radius, wide enough to cover several cells of every built-in grid. */
const BUILTIN_TEST_RADIUS = 10;

/**
 * Paints one full-density dab of a definition at the floor center.
 *
 * @param scene Test scene.
 * @param definition Definition to paint.
 * @returns Stroke result.
 */
function builtinTestStamp(scene: SprinkleTestScene, definition: SprinkleDefinition): SprinkleStrokeResult {
  const config = {
    ...StateSprinkleTool.configDefaultCreate(),
    definitionName: definition.name,
    radius: BUILTIN_TEST_RADIUS,
    densityPercent: 100,
  };
  const created = sprinkleStrokeCreate(scene.services, sprinkleSurfaceProjectorCreate(scene.services), config, {
    mode: config.mode,
    seed: config.seed,
  });
  if (!created.ok) throw new Error(created.message);
  created.stroke.dabApply({ point: BUILTIN_TEST_FLOOR_CENTER.clone(), normal: new THREE.Vector3(0, 1, 0) });
  return created.stroke.finish();
}

/**
 * Returns the class ids of the entities a stroke sprinkled into a scene.
 *
 * @param scene Test scene.
 * @returns Class id of every sprinkled entity.
 */
function builtinTestSprinkledClassIds(scene: SprinkleTestScene): string[] {
  return SprinkleMark.objectsCollect(scene.world).map((entity) => EntityClassRegistry.classOf(entity)?.id ?? '');
}

/**
 * Built-in sample sprinkle definitions: they parse cleanly, name real point
 * classes, and paint those entities onto a surface.
 */
describe('SprinkleDefinitionBuiltin', () => {
  let uninstall: () => void = () => undefined;

  beforeEach(() => {
    uninstall = sprinkleTestLibraryInstall(SprinkleDefinitionBuiltin.definitionsBuild());
  });

  afterEach(() => {
    uninstall();
  });

  it('builds every built-in file without problems and marks the sources as built-in', () => {
    const result = new SprinkleDefinitionBuilder().filesBuild(SPRINKLE_DEFINITION_BUILTIN_FILES);
    expect(result.problems).toEqual([]);
    expect(result.definitions.length).toBeGreaterThan(0);
    expect(SprinkleDefinitionBuiltin.definitionsBuild()).toEqual(result.definitions);
    for (const definition of result.definitions) {
      expect(definition.sourcePath.startsWith(SPRINKLE_DEFINITION_BUILTIN_PATH_PREFIX)).toBe(true);
    }
  });

  it('gives every built-in definition a grid and cases that name placeable point classes', () => {
    for (const definition of SprinkleDefinitionBuiltin.definitionsBuild()) {
      expect(definition.grid).not.toBeNull();
      expect(definition.cases.length).toBeGreaterThan(0);
      for (const definitionCase of definition.cases) {
        expect(SprinkleEntityFactory.pointClassResolve(definitionCase.className)?.id).toBe(definitionCase.className);
      }
    }
  });

  it('paints each built-in definition as entities of its case classes', () => {
    for (const definition of SprinkleDefinitionBuiltin.definitionsBuild()) {
      const scene = sprinkleTestSceneCreate(BUILTIN_TEST_FLOOR_CENTER, BUILTIN_TEST_FLOOR_SIZE);
      const result = builtinTestStamp(scene, definition);
      const caseClassIds = new Set(definition.cases.map((definitionCase) => definitionCase.className));
      const sprinkledClassIds = builtinTestSprinkledClassIds(scene);
      expect(result.added).toBeGreaterThan(0);
      expect(sprinkledClassIds.length).toBe(result.added);
      expect(sprinkledClassIds.every((classId) => caseClassIds.has(classId))).toBe(true);
    }
  });
});
