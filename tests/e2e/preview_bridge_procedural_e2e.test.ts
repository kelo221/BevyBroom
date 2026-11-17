import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import * as THREE from 'three';
import { EditorApi } from '@/ai/client/editor_api.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import { GlbExporter } from '@/io/glb/glb_exporter.js';
import { documentIdentityEnsure } from '@/io/document/document_identity.js';
import { PreviewLinkTransportHttp, type PreviewLinkTransport } from '@/preview/link/preview_link_transport.js';
import { PROCEDURAL_EXPORT_COMPONENT_TYPE_PATH } from '@/procedural/export/procedural_export_component.js';
import {
  PROCEDURAL_GENERATOR_BOX_CORNER_A,
  PROCEDURAL_GENERATOR_BOX_CORNER_B,
  PROCEDURAL_GENERATOR_BOX_ID,
} from '@/procedural/generator/box/procedural_generator_box.js';
import { editorApiTestHostCreate, type EditorApiTestHostParts } from '../ai/client/editor_api_test_host.js';
import { PreviewE2eGameProcess, previewE2eProjectCopy, previewE2eProjectRemove } from './preview_e2e_game_process.js';
import { PreviewE2eRig, previewE2eSleep } from './preview_e2e_rig.js';
import { e2eWindowsShownRead, previewE2eEnvironmentRead } from './preview_e2e_environment.js';
import { previewE2eEntityRowsQuery, type PreviewE2eEntityRow } from './preview_e2e_game_query.js';
import { PREVIEW_E2E_AUTHORED_NODE_COMPONENT, previewE2eObjectComponentRead } from './preview_e2e_game_components.js';

/**
 * End-to-end acceptance of procedural objects: a box placed and resized through
 * the editor's MCP tools reaches the game preview as a level mesh of the box's
 * size plus a `BroomProceduralProp` with its parameters, and an exported GLB
 * carries both into a game started without the editor. Skipped unless
 * BROOM_E2E_PREVIEW_EXE and BROOM_E2E_PROJECT_DIR are set; its games listen
 * twenty-seven and twenty-eight ports above BROOM_E2E_PORT.
 */
const environment = previewE2eEnvironmentRead(27);
const shippedEnvironment = previewE2eEnvironmentRead(28);
const STEP_TIMEOUT_MILLISECONDS = 60000;
const AABB_COMPONENT = 'bevy_camera::primitives::Aabb';
const TIGHT_BOUNDS_COMPONENT = 'broom_bridge::level::bounds::TightBounds';
const SHIPPED_SCENE_PATH = 'shipped/procedural_level.glb';

/** First corner of the placed box, in the box's own space. */
const CORNER_A = new THREE.Vector3(-1, 0, -0.5);

/** Opposite corner of the placed box before and after the resize. */
const CORNER_B_PLACED = new THREE.Vector3(1, 2, 0.5);
const CORNER_B_RESIZED = new THREE.Vector3(3, 1, 1.5);

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
 * Reads a vector the remote protocol serialized as an array or as x, y, z.
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
 * Returns the bounds of the level primitives in the game.
 *
 * @param rows Rows of a query for boxes, with the tight bounds marker reported.
 * @returns Local boxes of rows carrying the marker.
 */
function levelBoxesRead(rows: PreviewE2eEntityRow[]): THREE.Box3[] {
  return rows
    .filter((row) => row.has?.[TIGHT_BOUNDS_COMPONENT] === true)
    .map((row) => {
      const aabb = row.components[AABB_COMPONENT] as { center: unknown; half_extents: unknown };
      const halfExtents = vectorRead(aabb.half_extents);
      return new THREE.Box3().setFromCenterAndSize(vectorRead(aabb.center), halfExtents.multiplyScalar(2));
    });
}

/**
 * Returns whether a game box equals the box between two corners.
 *
 * @param box Box the game reports.
 * @param cornerB Opposite corner of the editor box.
 * @returns True when both corners match within single precision.
 */
function boxMatches(box: THREE.Box3, cornerB: THREE.Vector3): boolean {
  const expected = new THREE.Box3().setFromPoints([CORNER_A, cornerB]);
  return box.min.distanceTo(expected.min) < 1e-4 && box.max.distanceTo(expected.max) < 1e-4;
}

/**
 * Reads the procedural prop a game shows for any node.
 *
 * @param transport Transport to the game.
 * @returns Serialized props.
 */
async function proceduralPropsRead(transport: PreviewLinkTransport): Promise<Record<string, unknown>[]> {
  const rows = await previewE2eEntityRowsQuery(transport, [PROCEDURAL_EXPORT_COMPONENT_TYPE_PATH]);
  return rows.map((row) => row.components[PROCEDURAL_EXPORT_COMPONENT_TYPE_PATH] as Record<string, unknown>);
}

/**
 * Returns whether a serialized prop carries the box with a given corner B.
 *
 * @param prop Serialized `BroomProceduralProp`.
 * @param cornerB Expected corner B.
 * @returns True when generator and both corners match.
 */
function propMatches(prop: Record<string, unknown> | null, cornerB: THREE.Vector3): boolean {
  if (prop === null || prop['generator'] !== PROCEDURAL_GENERATOR_BOX_ID) {
    return false;
  }
  const parameters = JSON.parse(String(prop['parameters'])) as Record<string, number[]>;
  const cornerAGame = new THREE.Vector3(...(parameters[PROCEDURAL_GENERATOR_BOX_CORNER_A] ?? []));
  const cornerBGame = new THREE.Vector3(...(parameters[PROCEDURAL_GENERATOR_BOX_CORNER_B] ?? []));
  return cornerAGame.distanceTo(CORNER_A) < 1e-6 && cornerBGame.distanceTo(cornerB) < 1e-6;
}

describe.skipIf(!environment.isConfigured)('procedural objects in the game preview end to end', () => {
  let projectDirectory = '';
  let game: PreviewE2eGameProcess;
  let parts: EditorApiTestHostParts;
  let api: EditorApi;
  let rig: PreviewE2eRig;
  let boxId = '';

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
    rig = new PreviewE2eRig(parts.world, environment.endpoint, 'procedural_level');
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
   * @param check Reads the game and returns a value when satisfied, else null.
   * @returns The value the check returned.
   */
  async function gameUntil<Value>(description: string, check: () => Promise<Value | null>): Promise<Value> {
    const end = performance.now() + STEP_TIMEOUT_MILLISECONDS;
    while (performance.now() < end) {
      await rig.run(250);
      const value = await check().catch(() => null);
      if (value !== null) {
        return value;
      }
    }
    throw new Error(`Timed out waiting for ${description}; link error: ${rig.controller.lastErrorRead()}`);
  }

  /**
   * Waits until the game shows the box with a given corner B, as mesh and as
   * parameters.
   *
   * @param cornerB Expected corner B.
   */
  async function gameBoxUntil(cornerB: THREE.Vector3): Promise<void> {
    await gameUntil('the box parameters', async () => {
      const prop = await previewE2eObjectComponentRead(
        rig.transport,
        PREVIEW_E2E_AUTHORED_NODE_COMPONENT,
        boxId,
        PROCEDURAL_EXPORT_COMPONENT_TYPE_PATH,
      );
      return propMatches(prop, cornerB) ? true : null;
    });
    await gameUntil('the box mesh', async () => {
      const rows = await previewE2eEntityRowsQuery(rig.transport, [AABB_COMPONENT], [TIGHT_BOUNDS_COMPONENT]);
      return levelBoxesRead(rows).some((box) => boxMatches(box, cornerB)) ? true : null;
    });
  }

  it(
    'shows a box placed through MCP as a level mesh carrying its parameters',
    async () => {
      boxId = toolData<{ id: string }>(
        api.invokeTool('add_procedural', {
          position: { x: 2, y: 0, z: -3 },
          settings: {
            generatorId: PROCEDURAL_GENERATOR_BOX_ID,
            parameters: {
              [PROCEDURAL_GENERATOR_BOX_CORNER_A]: CORNER_A.toArray(),
              [PROCEDURAL_GENERATOR_BOX_CORNER_B]: CORNER_B_PLACED.toArray(),
            },
          },
        }),
      ).id;
      await gameBoxUntil(CORNER_B_PLACED);
    },
    STEP_TIMEOUT_MILLISECONDS * 2,
  );

  it(
    'rebuilds the mesh and the parameters in the game when a corner moves',
    async () => {
      toolData(
        api.invokeTool('set_procedural_settings', {
          id: boxId,
          settings: { parameters: { [PROCEDURAL_GENERATOR_BOX_CORNER_B]: CORNER_B_RESIZED.toArray() } },
        }),
      );
      await gameBoxUntil(CORNER_B_RESIZED);
    },
    STEP_TIMEOUT_MILLISECONDS * 2,
  );

  it(
    'ships the box mesh and its parameters in an exported GLB',
    async () => {
      const shippedFile = join(projectDirectory, 'assets', SHIPPED_SCENE_PATH);
      mkdirSync(dirname(shippedFile), { recursive: true });
      writeFileSync(shippedFile, new Uint8Array(await new GlbExporter().exportForFile(parts.world)));
      const shippedProject = previewE2eProjectCopy(projectDirectory);
      const shippedGame = new PreviewE2eGameProcess(
        shippedEnvironment.previewExecutable,
        shippedProject,
        shippedEnvironment.bridgePort,
        e2eWindowsShownRead(),
        ['--scene', SHIPPED_SCENE_PATH],
      );
      shippedGame.start();
      try {
        await shippedBoxWait(new PreviewLinkTransportHttp(shippedEnvironment.endpoint));
      } finally {
        await shippedGame.stop();
        previewE2eProjectRemove(shippedProject);
      }
    },
    STEP_TIMEOUT_MILLISECONDS * 2,
  );

  /**
   * Waits until the shipped game shows the resized box's parameters and mesh.
   *
   * @param transport Transport to the shipped game.
   */
  async function shippedBoxWait(transport: PreviewLinkTransport): Promise<void> {
    const end = performance.now() + STEP_TIMEOUT_MILLISECONDS;
    let lastProps: unknown = null;
    while (performance.now() < end) {
      const props = await proceduralPropsRead(transport).catch(() => []);
      const rows = await previewE2eEntityRowsQuery(transport, [AABB_COMPONENT]).catch(() => []);
      lastProps = props;
      const hasProp = props.some((prop) => propMatches(prop, CORNER_B_RESIZED));
      const boxes = rows.map((row) => {
        const aabb = row.components[AABB_COMPONENT] as { center: unknown; half_extents: unknown };
        return new THREE.Box3().setFromCenterAndSize(
          vectorRead(aabb.center),
          vectorRead(aabb.half_extents).multiplyScalar(2),
        );
      });
      if (hasProp && boxes.some((box) => boxMatches(box, CORNER_B_RESIZED))) {
        expect(props).toHaveLength(1);
        return;
      }
      await previewE2eSleep(250);
    }
    throw new Error(`Timed out waiting for the shipped box; last props: ${JSON.stringify(lastProps)}`);
  }
});
