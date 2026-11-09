import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { EditorApi } from '@/ai/client/editor_api.js';
import { findMcpTool } from '@/ai/server/registry_mcp_tool.js';
import { SprinkleMark } from '@/tools/sprinkle/mark/sprinkle_mark.js';
import { getStateSprinkleTool } from '@/tools/sprinkle/state_sprinkle_tool.js';
import { SPRINKLE_PLACEMENT_MODES } from '@/tools/sprinkle/sprinkle_types.js';
import { editorApiTestHostCreate, type EditorApiTestHostParts } from './editor_api_test_host.js';
import {
  SPRINKLE_TEST_DEFINITION_NAME,
  sprinkleTestDefinitionCreate,
  sprinkleTestLibraryInstall,
  sprinkleTestTopHeightRead,
} from '../../tools/sprinkle/sprinkle_test_support.js';

/** Center of the floor's top face the stamps land on. */
const SPRINKLE_API_TEST_FLOOR_CENTER = new THREE.Vector3(5.5, 2, -3.5);

/** An EditorApi over a world holding one floor. */
interface SprinkleApiTestRig extends EditorApiTestHostParts {
  api: EditorApi;
  floor: THREE.Mesh;
}

/**
 * Builds an EditorApi over a world holding a flat floor.
 *
 * @returns The rig.
 */
function sprinkleApiTestRigCreate(): SprinkleApiTestRig {
  const parts = editorApiTestHostCreate();
  const floor = new THREE.Mesh(new THREE.BoxGeometry(30, 1, 30));
  floor.position.copy(SPRINKLE_API_TEST_FLOOR_CENTER).setY(SPRINKLE_API_TEST_FLOOR_CENTER.y - 0.5);
  parts.world.add(floor);
  parts.world.updateMatrixWorld(true);
  return { ...parts, api: new EditorApi(parts.host), floor };
}

/**
 * Returns the center argument of a stamp on the floor.
 *
 * @returns Center as an `{ x, y, z }` argument.
 */
function sprinkleApiTestCenter(): { x: number; y: number; z: number } {
  return {
    x: SPRINKLE_API_TEST_FLOOR_CENTER.x,
    y: SPRINKLE_API_TEST_FLOOR_CENTER.y,
    z: SPRINKLE_API_TEST_FLOOR_CENTER.z,
  };
}

/**
 * The sprinkle MCP tools list sprinkle types and paint one undoable stroke per
 * stamp.
 */
describe('EditorApiSprinkle', () => {
  let uninstall: () => void = () => undefined;

  beforeEach(() => {
    uninstall = sprinkleTestLibraryInstall([sprinkleTestDefinitionCreate(undefined, 0.5)]);
  });

  afterEach(() => {
    getStateSprinkleTool().reset();
    uninstall();
  });

  it('lists both tools in the MCP catalog with their required arguments', () => {
    expect(findMcpTool('sprinkle_definitions_list')).toBeDefined();
    const stamp = findMcpTool('sprinkle_stamp');
    expect(stamp?.inputSchema['required']).toEqual(['definition', 'center']);
    const properties = stamp?.inputSchema['properties'] as Record<string, { enum?: string[] }>;
    expect(properties['mode']?.enum).toEqual([...SPRINKLE_PLACEMENT_MODES]);
  });

  it('lists the loaded definitions with their grid and case count', () => {
    const result = sprinkleApiTestRigCreate().api.invokeTool('sprinkle_definitions_list', {});
    const definition = sprinkleTestDefinitionCreate(undefined, 0.5);
    expect(result.ok).toBe(true);
    expect(result.data).toEqual({
      definitions: [
        {
          name: definition.name,
          sourcePath: definition.sourcePath,
          grid: definition.grid,
          caseCount: definition.cases.length,
        },
      ],
      problems: [],
    });
  });

  it('stamps marked entities onto the floor as one undo step and erases them again', () => {
    const rig = sprinkleApiTestRigCreate();
    const stampArgs = {
      definition: SPRINKLE_TEST_DEFINITION_NAME,
      center: sprinkleApiTestCenter(),
      radius: 2,
      densityPercent: 100,
    };
    const added = rig.api.invokeTool('sprinkle_stamp', stampArgs);
    const sprinkled = SprinkleMark.objectsCollect(rig.world);
    const addedCount = (added.data as { added: number }).added;
    expect(added.ok).toBe(true);
    expect(addedCount).toBeGreaterThan(0);
    expect(sprinkled.length).toBe(addedCount);
    expect(sprinkled.every((entity) => Math.abs(entity.position.y - sprinkleTestTopHeightRead(rig.floor)) < 1e-6)).toBe(
      true,
    );
    expect(rig.commandStack.getUndoCount()).toBe(1);
    const erased = rig.api.invokeTool('sprinkle_stamp', { ...stampArgs, mode: 'SUBTRACTIVE' });
    expect(erased.data).toEqual({ added: 0, removed: addedCount });
    rig.commandStack.undo();
    expect(SprinkleMark.objectsCollect(rig.world).length).toBe(addedCount);
  });

  it('fails for unknown types, bad modes and bad centers without touching the scene', () => {
    const rig = sprinkleApiTestRigCreate();
    const center = sprinkleApiTestCenter();
    expect(rig.api.invokeTool('sprinkle_stamp', { definition: 'missing', center }).ok).toBe(false);
    expect(
      rig.api.invokeTool('sprinkle_stamp', { definition: SPRINKLE_TEST_DEFINITION_NAME, center, mode: 'BOGUS' }).ok,
    ).toBe(false);
    expect(
      rig.api.invokeTool('sprinkle_stamp', { definition: SPRINKLE_TEST_DEFINITION_NAME, center: { x: 1 } }).ok,
    ).toBe(false);
    expect(rig.commandStack.canUndo()).toBe(false);
  });
});
