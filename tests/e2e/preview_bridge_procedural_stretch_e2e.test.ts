import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as THREE from 'three';
import { EditorApi } from '@/ai/client/editor_api.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import { documentIdentityEnsure } from '@/io/document/document_identity.js';
import { PROCEDURAL_EXPORT_COMPONENT_TYPE_PATH } from '@/procedural/export/procedural_export_component.js';
import {
  PROCEDURAL_GENERATOR_GIRDER_ID,
  PROCEDURAL_GIRDER_END,
} from '@/procedural/generator/girder/procedural_generator_girder.js';
import { ProceduralGeneratorRegistry } from '@/procedural/generator/procedural_generator_registry.js';
import {
  PROCEDURAL_GENERATOR_RAILING_ID,
  PROCEDURAL_RAILING_END,
} from '@/procedural/generator/railing/procedural_generator_railing.js';
import {
  PROCEDURAL_GENERATOR_WINDOW_ID,
  PROCEDURAL_WINDOW_CORNER_B,
} from '@/procedural/generator/window/procedural_generator_window.js';
import { ProceduralOwner } from '@/procedural/model/procedural_owner.js';
import { editorApiTestHostCreate, type EditorApiTestHostParts } from '../ai/client/editor_api_test_host.js';
import { PreviewE2eGameProcess, previewE2eProjectCopy, previewE2eProjectRemove } from './preview_e2e_game_process.js';
import { PreviewE2eRig } from './preview_e2e_rig.js';
import { e2eWindowsShownRead, previewE2eEnvironmentRead } from './preview_e2e_environment.js';
import { previewE2eEntityRowsQuery } from './preview_e2e_game_query.js';
import { PREVIEW_E2E_AUTHORED_NODE_COMPONENT, previewE2eObjectComponentRead } from './preview_e2e_game_components.js';

/**
 * End-to-end acceptance of the stretchable procedural generators: a girder, a
 * railing and a window placed and stretched through the editor's MCP tools
 * reach the game preview with the editor's parameters and as level geometry
 * that covers what the editor builds. Skipped unless BROOM_E2E_PREVIEW_EXE and
 * BROOM_E2E_PROJECT_DIR are set; its game listens 34 ports above
 * BROOM_E2E_PORT.
 */
const environment = previewE2eEnvironmentRead(34);
const STEP_TIMEOUT_MILLISECONDS = 60000;
const AABB_COMPONENT = 'bevy_camera::primitives::Aabb';
const TIGHT_BOUNDS_COMPONENT = 'broom_bridge::level::bounds::TightBounds';
const GLOBAL_TRANSFORM_COMPONENT = 'bevy_transform::components::global_transform::GlobalTransform';
const BOUNDS_TOLERANCE = 1e-3;

/** One generator under test and the point field that stretches it. */
interface StretchCase {
  readonly generatorId: string;
  readonly stretchPath: string;
  readonly position: THREE.Vector3;
}

/** Every generator under test, placed apart from the others. */
const STRETCH_CASES: readonly StretchCase[] = [
  {
    generatorId: PROCEDURAL_GENERATOR_GIRDER_ID,
    stretchPath: PROCEDURAL_GIRDER_END,
    position: new THREE.Vector3(0, 0, 0),
  },
  {
    generatorId: PROCEDURAL_GENERATOR_RAILING_ID,
    stretchPath: PROCEDURAL_RAILING_END,
    position: new THREE.Vector3(0, 0, 10),
  },
  {
    generatorId: PROCEDURAL_GENERATOR_WINDOW_ID,
    stretchPath: PROCEDURAL_WINDOW_CORNER_B,
    position: new THREE.Vector3(0, 0, 20),
  },
];

/**
 * Returns the data of a successful tool result.
 *
 * @param result Tool result.
 * @returns The result data.
 */
function toolData<Data>(result: McpToolResult): Data {
  if (!result.ok) {
    throw new Error(`tool failed: ${result.message}`);
  }
  return result.data as Data;
}

/**
 * Reads a vector the remote protocol serialized.
 *
 * @param value Serialized vector.
 * @returns The vector.
 */
function vectorRead(value: unknown): THREE.Vector3 {
  if (Array.isArray(value)) {
    return new THREE.Vector3(Number(value[0]), Number(value[1]), Number(value[2]));
  }
  const vector = value as { x: number; y: number; z: number };
  return new THREE.Vector3(vector.x, vector.y, vector.z);
}

/**
 * Reads a global transform the remote protocol serialized as an affine map:
 * three matrix columns followed by the translation.
 *
 * @param value Serialized global transform.
 * @returns The map as a matrix; identity when the value is not twelve numbers.
 */
function affineRead(value: unknown): THREE.Matrix4 {
  if (!Array.isArray(value) || value.length !== 12) {
    return new THREE.Matrix4();
  }
  const numbers = value.map(Number);
  const at = (index: number): number => numbers[index] ?? 0;
  return new THREE.Matrix4().set(
    at(0),
    at(3),
    at(6),
    at(9),
    at(1),
    at(4),
    at(7),
    at(10),
    at(2),
    at(5),
    at(8),
    at(11),
    0,
    0,
    0,
    1,
  );
}

/**
 * Returns the world box of everything a procedural object builds.
 *
 * @param owner Procedural owner.
 * @returns World box of its parts.
 */
function editorPartsBoxOf(owner: THREE.Object3D): THREE.Box3 {
  const settings = ProceduralOwner.settingsRead(owner);
  const generator = settings ? ProceduralGeneratorRegistry.find(settings.generatorId) : null;
  const parts = settings && generator ? generator.partsBuild(settings.parameters) : [];
  owner.updateWorldMatrix(true, false);
  const points = parts.flatMap((part) =>
    part.faces.flat().map((point) => point.clone().applyMatrix4(owner.matrixWorld)),
  );
  return new THREE.Box3().setFromPoints(points);
}

/**
 * Returns whether one box holds another within a tolerance.
 *
 * @param outer Box that should hold the other.
 * @param inner Box that should be held.
 * @returns True when inner lies inside outer.
 */
function boxHolds(outer: THREE.Box3, inner: THREE.Box3): boolean {
  return outer.clone().expandByScalar(BOUNDS_TOLERANCE).containsBox(inner);
}

describe.skipIf(!environment.isConfigured)('stretchable procedural objects in the game preview end to end', () => {
  let projectDirectory = '';
  let game: PreviewE2eGameProcess;
  let parts: EditorApiTestHostParts;
  let api: EditorApi;
  let rig: PreviewE2eRig;
  const objectIds = new Map<string, string>();

  beforeAll(() => {
    projectDirectory = previewE2eProjectCopy(environment.sourceProjectDirectory);
    game = new PreviewE2eGameProcess(
      environment.previewExecutable,
      projectDirectory,
      environment.bridgePort,
      e2eWindowsShownRead(),
    );
    game.start();
    parts = editorApiTestHostCreate();
    api = new EditorApi(parts.host);
    documentIdentityEnsure(parts.world);
    rig = new PreviewE2eRig(parts.world, environment.endpoint, 'procedural_stretch_level');
  });

  afterAll(async () => {
    rig?.controller.disconnect();
    await game?.stop();
    if (projectDirectory !== '') {
      previewE2eProjectRemove(projectDirectory);
    }
  });

  /**
   * Keeps the editor link updating until a check on the game passes.
   *
   * @param description What is waited for.
   * @param check Reads the game and returns true when satisfied.
   */
  async function gameUntil(description: string, check: () => Promise<boolean>): Promise<void> {
    const end = performance.now() + STEP_TIMEOUT_MILLISECONDS;
    while (performance.now() < end) {
      await rig.run(250);
      if (await check().catch(() => false)) {
        return;
      }
    }
    throw new Error(`Timed out waiting for ${description}; link error: ${rig.controller.lastErrorRead()}`);
  }

  /**
   * Returns whether the game carries an object's current parameters.
   *
   * @param id Object id.
   * @returns True when generator and parameters match the editor.
   */
  async function gameParametersMatch(id: string): Promise<boolean> {
    const owner = parts.world.getObjectByProperty('uuid', id);
    const settings = owner ? ProceduralOwner.settingsRead(owner) : null;
    const prop = await previewE2eObjectComponentRead(
      rig.transport,
      PREVIEW_E2E_AUTHORED_NODE_COMPONENT,
      id,
      PROCEDURAL_EXPORT_COMPONENT_TYPE_PATH,
    );
    if (settings === null || prop === null || prop['generator'] !== settings.generatorId) {
      return false;
    }
    return JSON.stringify(JSON.parse(String(prop['parameters']))) === JSON.stringify(settings.parameters);
  }

  /**
   * Returns whether the game's level geometry covers everything the editor
   * builds for every placed object.
   *
   * @returns True when the union of the game's level boxes holds each object.
   */
  async function gameGeometryCovers(): Promise<boolean> {
    const rows = await previewE2eEntityRowsQuery(
      rig.transport,
      [AABB_COMPONENT, GLOBAL_TRANSFORM_COMPONENT],
      [TIGHT_BOUNDS_COMPONENT],
    );
    const levelBox = new THREE.Box3();
    rows
      .filter((row) => row.has?.[TIGHT_BOUNDS_COMPONENT] === true)
      .forEach((row) => {
        const aabb = row.components[AABB_COMPONENT] as { center: unknown; half_extents: unknown };
        const size = vectorRead(aabb.half_extents).multiplyScalar(2);
        const localBox = new THREE.Box3().setFromCenterAndSize(vectorRead(aabb.center), size);
        levelBox.union(localBox.applyMatrix4(affineRead(row.components[GLOBAL_TRANSFORM_COMPONENT])));
      });
    return [...objectIds.values()].every((id) => {
      const owner = parts.world.getObjectByProperty('uuid', id);
      return owner !== undefined && boxHolds(levelBox, editorPartsBoxOf(owner));
    });
  }

  it(
    'shows a placed girder, railing and window in the game',
    async () => {
      await rig.until('the game link', (view) => rig.isCaughtUp(view), STEP_TIMEOUT_MILLISECONDS);
      for (const stretchCase of STRETCH_CASES) {
        const id = toolData<{ id: string }>(
          api.invokeTool('add_procedural', {
            position: { x: stretchCase.position.x, y: stretchCase.position.y, z: stretchCase.position.z },
            settings: { generatorId: stretchCase.generatorId },
          }),
        ).id;
        objectIds.set(stretchCase.generatorId, id);
      }
      for (const id of objectIds.values()) {
        await gameUntil(`the parameters of ${id}`, () => gameParametersMatch(id));
      }
      await gameUntil('level geometry covering every object', gameGeometryCovers);
    },
    STEP_TIMEOUT_MILLISECONDS * 4,
  );

  it(
    'follows each object stretched to twice its length',
    async () => {
      for (const stretchCase of STRETCH_CASES) {
        const id = objectIds.get(stretchCase.generatorId) ?? '';
        const owner = parts.world.getObjectByProperty('uuid', id);
        const settings = owner ? ProceduralOwner.settingsRead(owner) : null;
        const point = settings?.parameters[stretchCase.stretchPath];
        expect(Array.isArray(point)).toBe(true);
        const stretched = (point as number[]).map((value, axis) => (axis === 0 ? value * 2 + 1 : value));
        toolData(
          api.invokeTool('set_procedural_settings', {
            id,
            settings: { parameters: { [stretchCase.stretchPath]: stretched } },
          }),
        );
        await gameUntil(`the stretched parameters of ${stretchCase.generatorId}`, () => gameParametersMatch(id));
      }
      await gameUntil('level geometry covering every stretched object', gameGeometryCovers);
    },
    STEP_TIMEOUT_MILLISECONDS * 4,
  );
});
