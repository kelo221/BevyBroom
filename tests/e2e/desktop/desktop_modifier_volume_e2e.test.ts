import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import * as THREE from 'three';
import type { McpBounds, McpToolResult, McpVec3 } from '@/ai/shared/mcp_protocol_types.js';
import { PreviewLinkTransportHttp } from '@/preview/link/preview_link_transport.js';
import type { PreviewBridgeStatus } from '@/preview/protocol/preview_protocol_types.js';
import type { GameProcessPhase, GameProcessStatus } from '@/project/process/game_process_types.js';
import {
  e2eRequiredConfigurationAssert,
  e2eWindowsShownRead,
  previewE2eEnvironmentRead,
} from '../preview_e2e_environment.js';
import { previewE2eProjectRemove } from '../preview_e2e_game_process.js';
import {
  PREVIEW_E2E_NAME_COMPONENT,
  previewE2eEntityRowsQuery,
  previewE2eNameRead,
  type PreviewE2eEntityRow,
} from '../preview_e2e_game_query.js';
import { glbMeshNodesScenePositionsRead, glbNodeNamesRead } from '../../io/glb/glb_node_positions_read.js';
import { DesktopE2eAppProcess } from './desktop_e2e_app_process.js';
import { DesktopE2eMcpClient } from './desktop_e2e_mcp_client.js';
import { desktopE2eWaitUntil } from './desktop_e2e_wait.js';
import { desktopE2eProjectPrepare, type DesktopE2eProject } from './desktop_e2e_project_files.js';

/**
 * End-to-end acceptance of modifier volumes: the built desktop app builds a box
 * brush and a linear array modifier volume over it through its MCP tools, the
 * running game shows the box with its copies while the volume box never reaches
 * it, and Build Level writes geometry holding the copies and no volume. A
 * subtractive volume over half the box then cuts that half away in the game and
 * in the built level. Needs BROOM_E2E_DESKTOP_EXE, BROOM_E2E_PREVIEW_EXE,
 * BROOM_E2E_PROJECT_DIR and cargo on the PATH.
 */
const desktopExecutable = process.env['BROOM_E2E_DESKTOP_EXE'] ? resolve(process.env['BROOM_E2E_DESKTOP_EXE']) : '';
e2eRequiredConfigurationAssert(desktopExecutable !== '', ['BROOM_E2E_DESKTOP_EXE']);
const isCargoAvailable = spawnSync('cargo', ['--version'], { stdio: 'ignore' }).status === 0;
const mcpBasePort = Number(process.env['BROOM_E2E_MODIFIER_MCP_PORT'] ?? '19065');
const environment = previewE2eEnvironmentRead(25);
const isConfigured = desktopExecutable !== '' && environment.isConfigured && isCargoAvailable;
const LAUNCH_TIMEOUT_MILLISECONDS = 90000;
const BUILD_TIMEOUT_MILLISECONDS = 180000;
const STEP_TIMEOUT_MILLISECONDS = 60000;
const AABB_COMPONENT = 'bevy_camera::primitives::Aabb';
const TIGHT_BOUNDS_COMPONENT = 'broom_bridge::level::bounds::TightBounds';
const LEVEL_NAME = 'e2e_modifier_array';
const LEVEL_NAME_CUT = 'e2e_modifier_subtract';
const BOUNDS_TOLERANCE = 1e-3;

/** Center of the source box, far from anything the project scene may hold. */
const SOURCE_CENTER: McpVec3 = { x: 1000, y: 1, z: 0 };

/** Edge length of the source box. */
const SOURCE_EDGE = 2;

/** Distance between neighbouring copies along +X. */
const COPY_STEP = SOURCE_EDGE * 2;

/** Copies of the array, the original included. */
const COPY_COUNT = 3;

/** How far the volume box reaches past the source box on every side. */
const VOLUME_MARGIN = SOURCE_EDGE / 2;

/** Half width of the region around the source in which level bounds count. */
const REGION_HALF_WIDTH = COPY_STEP * COPY_COUNT * 4;

/** Project status returned by the project tools. */
type ModifierE2eProjectStatus = GameProcessStatus & { canManageGames: boolean };

/** Game preview view returned by the preview_status tool. */
interface ModifierE2ePreviewStatus {
  connection: string;
  revisions: { state: number; geometry: number } | null;
  game: PreviewBridgeStatus | null;
}

/** Data of a successful build_level reply. */
interface ModifierE2eLevelBuild {
  levelDirectory: string;
  geometryFile: string;
}

/**
 * Returns the data of a tool result as a given shape.
 *
 * @param result Successful tool result.
 * @returns The result data.
 */
function toolDataRead<Data>(result: McpToolResult): Data {
  return result.data as Data;
}

/**
 * Reads a vector the remote protocol serialized as an array or as x, y, z.
 *
 * @param value Serialized vector.
 * @returns Vector.
 */
function vectorRead(value: unknown): THREE.Vector3 {
  if (Array.isArray(value)) return new THREE.Vector3().fromArray(value.map(Number));
  const vector = value as { x: number; y: number; z: number };
  return new THREE.Vector3(vector.x, vector.y, vector.z);
}

/**
 * Returns the union of the game's level primitive bounds that lie around the
 * source box.
 *
 * @param rows Rows of a query for boxes, with the tight bounds marker reported.
 * @returns Union bounds, or null when no primitive lies there.
 */
function regionBoundsRead(rows: readonly PreviewE2eEntityRow[]): THREE.Box3 | null {
  const union = new THREE.Box3();
  for (const row of rows) {
    if (row.has?.[TIGHT_BOUNDS_COMPONENT] !== true) continue;
    const aabb = row.components[AABB_COMPONENT] as { center: unknown; half_extents: unknown };
    const center = vectorRead(aabb.center);
    if (Math.abs(center.x - SOURCE_CENTER.x) > REGION_HALF_WIDTH) continue;
    const halfExtents = vectorRead(aabb.half_extents);
    union.union(new THREE.Box3(center.clone().sub(halfExtents), center.clone().add(halfExtents)));
  }
  return union.isEmpty() ? null : union;
}

/**
 * Returns the bounds the source box and its copies cover together.
 *
 * @param source World bounds of the source box.
 * @returns Expected bounds of the arrayed geometry.
 */
function arrayedBoundsExpected(source: McpBounds): THREE.Box3 {
  const box = new THREE.Box3(vectorRead(source.min), vectorRead(source.max));
  box.max.x += COPY_STEP * (COPY_COUNT - 1);
  return box;
}

/**
 * Returns whether two boxes match within the test tolerance.
 *
 * @param actual Measured box.
 * @param expected Expected box.
 * @returns True when every corner component matches.
 */
function boundsMatch(actual: THREE.Box3, expected: THREE.Box3): boolean {
  const corners = [actual.min.distanceTo(expected.min), actual.max.distanceTo(expected.max)];
  return corners.every((distance) => distance < BOUNDS_TOLERANCE);
}

describe.skipIf(!isConfigured)('desktop app modifier volume end to end', () => {
  const app = new DesktopE2eAppProcess(desktopExecutable, mcpBasePort, e2eWindowsShownRead());
  const transport = new PreviewLinkTransportHttp(environment.endpoint);
  let client: DesktopE2eMcpClient;
  let project: DesktopE2eProject;
  let sourceBounds: McpBounds;
  let volumeName = '';
  let arrayVolumeId = '';
  let subtractVolumeName = '';

  /**
   * Waits until the managed game reaches a phase.
   *
   * @param phase Awaited phase.
   * @param timeoutMilliseconds Longest wait.
   * @returns The matching status.
   */
  async function phaseWait(
    phase: GameProcessPhase,
    timeoutMilliseconds = BUILD_TIMEOUT_MILLISECONDS,
  ): Promise<ModifierE2eProjectStatus> {
    return desktopE2eWaitUntil(
      `the game to reach ${phase}`,
      async () => {
        const status = toolDataRead<ModifierE2eProjectStatus>(await client.toolCallExpectOk('project_status'));
        return status.phase === phase ? status : null;
      },
      timeoutMilliseconds,
    );
  }

  /**
   * Returns whether a preview status shows a connected game of this project
   * that applied everything the editor sent.
   *
   * @param status Preview status.
   * @returns True when the game is caught up.
   */
  function gameIsCaughtUp(status: ModifierE2ePreviewStatus): boolean {
    const game = status.game;
    const isProjectGame = game !== null && game.project_id === project.projectIdentifier;
    const isCaughtUp =
      isProjectGame && status.revisions !== null && game.state_revision_applied === status.revisions.state;
    return status.connection === 'connected' && isCaughtUp;
  }

  /** Launches the game and waits until it applied the document. */
  async function gameLaunchAndCatchUp(): Promise<void> {
    await client.toolCallExpectOk('game_launch');
    await phaseWait('running');
    await desktopE2eWaitUntil(
      'the game to apply the document',
      async () => {
        const preview = toolDataRead<ModifierE2ePreviewStatus>(await client.toolCallExpectOk('preview_status'));
        return gameIsCaughtUp(preview) ? true : null;
      },
      LAUNCH_TIMEOUT_MILLISECONDS,
    );
  }

  /**
   * Builds a solid model holding only the source box and returns the box's
   * world bounds.
   *
   * @returns World bounds of the source box.
   */
  async function sourceBuild(): Promise<McpBounds> {
    const created = await client.toolCallExpectOk('create_solid_model', { name: 'ModifierArraySource' });
    const { modelId, brushId } = toolDataRead<{ modelId: string; brushId: string }>(created);
    const added = await client.toolCallExpectOk('add_box_brush', {
      modelId,
      size: { x: SOURCE_EDGE, y: SOURCE_EDGE, z: SOURCE_EDGE },
      position: SOURCE_CENTER,
      snap: false,
    });
    await client.toolCallExpectOk('delete_brushes', { brushIds: [brushId] });
    const sourceId = toolDataRead<{ brushId: string }>(added).brushId;
    const brush = await client.toolCallExpectOk('get_brush', { brushId: sourceId });
    return toolDataRead<{ worldBounds: McpBounds }>(brush).worldBounds;
  }

  /**
   * Adds a linear array volume that covers only the source box.
   *
   * @returns Name of the new volume.
   */
  async function arrayVolumeAdd(): Promise<{ id: string; name: string }> {
    const volumeEdge = SOURCE_EDGE + VOLUME_MARGIN * 2;
    const created = await client.toolCallExpectOk('add_modifier_volume', {
      template: 'linear',
      center: SOURCE_CENTER,
      size: { x: volumeEdge, y: volumeEdge, z: volumeEdge },
      name: `ModifierArrayVolume${Math.random().toString(36).slice(2, 8)}`,
      modifiers: [{ kind: 'linear', parameters: { mode: 'fixed', offsetX: COPY_STEP, count: COPY_COUNT } }],
    });
    return toolDataRead<{ id: string; name: string }>(created);
  }

  /**
   * Adds a subtractive volume that covers the +X half of the source box and
   * reaches past it on every other side.
   *
   * @returns Name of the new volume and why its box would not be written.
   */
  async function subtractVolumeAdd(): Promise<{ name: string; operationIssue: string }> {
    const sourceBox = new THREE.Box3(vectorRead(sourceBounds.min), vectorRead(sourceBounds.max));
    const sourceSize = sourceBox.getSize(new THREE.Vector3());
    const reach = sourceSize.clone().addScalar(VOLUME_MARGIN * 2);
    const created = await client.toolCallExpectOk('add_modifier_volume', {
      center: { x: sourceBox.max.x, y: SOURCE_CENTER.y, z: SOURCE_CENTER.z },
      size: { x: sourceSize.x, y: reach.y, z: reach.z },
      name: `ModifierSubtractVolume${Math.random().toString(36).slice(2, 8)}`,
      operation: 'subtract',
    });
    return toolDataRead<{ name: string; operationIssue: string }>(created);
  }

  /**
   * Returns the bounds of the source box with its +X half cut away.
   *
   * @returns Expected bounds after the subtractive volume.
   */
  function cutBoundsExpected(): THREE.Box3 {
    const box = new THREE.Box3(vectorRead(sourceBounds.min), vectorRead(sourceBounds.max));
    box.max.x = box.getCenter(new THREE.Vector3()).x;
    return box;
  }

  /**
   * Builds a level and returns the bounds of its geometry around the source.
   *
   * @param levelName Level to build.
   * @returns GLB bytes and the region bounds.
   */
  async function levelRegionBuild(levelName: string): Promise<{ buffer: ArrayBuffer; bounds: THREE.Box3 }> {
    const built = toolDataRead<ModifierE2eLevelBuild>(await client.toolCallExpectOk('build_level', { levelName }));
    const bytes = readFileSync(join(built.levelDirectory, built.geometryFile));
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    return { buffer, bounds: glbRegionBoundsRead(buffer) };
  }

  /**
   * Waits until the game's level geometry around the source covers given
   * bounds.
   *
   * @param expected Awaited bounds.
   * @param description What the bounds mean, used in the timeout error.
   * @returns The measured bounds.
   */
  async function gameRegionBoundsWait(expected: THREE.Box3, description: string): Promise<THREE.Box3> {
    return desktopE2eWaitUntil(
      `the game geometry to cover ${description}`,
      async () => {
        const rows = await previewE2eEntityRowsQuery(transport, [AABB_COMPONENT], [TIGHT_BOUNDS_COMPONENT]);
        const bounds = regionBoundsRead(rows);
        return bounds && boundsMatch(bounds, expected) ? bounds : null;
      },
      STEP_TIMEOUT_MILLISECONDS,
    );
  }

  /**
   * Returns the names of every named entity in the game.
   *
   * @returns Entity names.
   */
  async function gameEntityNamesRead(): Promise<string[]> {
    const rows = await previewE2eEntityRowsQuery(transport, [PREVIEW_E2E_NAME_COMPONENT]);
    return rows.map((row) => previewE2eNameRead(row.components[PREVIEW_E2E_NAME_COMPONENT]));
  }

  /**
   * Returns the scene-space bounds of every mesh node of a GLB file that lies
   * around the source box. Mesh nodes are told apart by index, since every
   * solid model names its result mesh node the same.
   *
   * @param buffer GLB bytes.
   * @returns Union bounds of those mesh positions; empty when none lies there.
   */
  function glbRegionBoundsRead(buffer: ArrayBuffer): THREE.Box3 {
    const union = new THREE.Box3();
    for (const node of glbMeshNodesScenePositionsRead(buffer)) {
      const nodeBounds = new THREE.Box3().setFromPoints(node.positions);
      if (Math.abs(nodeBounds.getCenter(new THREE.Vector3()).x - SOURCE_CENTER.x) > REGION_HALF_WIDTH) continue;
      union.union(nodeBounds);
    }
    return union;
  }

  beforeAll(async () => {
    project = desktopE2eProjectPrepare({
      sourceProjectDirectory: environment.sourceProjectDirectory,
      previewExecutable: environment.previewExecutable,
      projectIdentifier: `modifier-e2e-${Math.random().toString(36).slice(2, 8)}`,
      bridgePort: environment.bridgePort,
      isWindowShown: e2eWindowsShownRead(),
    });
    app.start();
    client = new DesktopE2eMcpClient(await app.mcpUrlWait(LAUNCH_TIMEOUT_MILLISECONDS));
    await client.initialize();
    await desktopE2eWaitUntil(
      'the editor to answer tools',
      async () => ((await client.toolCall('get_editor_context')).ok ? true : null),
      LAUNCH_TIMEOUT_MILLISECONDS,
    );
  }, LAUNCH_TIMEOUT_MILLISECONDS * 2);

  afterAll(async () => {
    if (client) {
      await client.toolCall('game_stop').catch(() => undefined);
      await phaseWait('stopped', STEP_TIMEOUT_MILLISECONDS / 2).catch(() => undefined);
    }
    await app.stop();
    if (project) {
      previewE2eProjectRemove(project.directory);
    }
  });

  it(
    'shows the arrayed copies in the running game while the volume itself never reaches it',
    async () => {
      await client.toolCallExpectOk('project_open', { path: project.projectFile });
      await gameLaunchAndCatchUp();
      sourceBounds = await sourceBuild();
      const sourceBox = new THREE.Box3(vectorRead(sourceBounds.min), vectorRead(sourceBounds.max));
      await gameRegionBoundsWait(sourceBox, 'the source box alone');
      const arrayVolume = await arrayVolumeAdd();
      volumeName = arrayVolume.name;
      arrayVolumeId = arrayVolume.id;
      await gameRegionBoundsWait(arrayedBoundsExpected(sourceBounds), 'the source box and its copies');
      expect(await gameEntityNamesRead()).not.toContain(volumeName);
    },
    BUILD_TIMEOUT_MILLISECONDS + STEP_TIMEOUT_MILLISECONDS * 3,
  );

  it(
    'builds a level whose geometry holds the copies and no modifier volume',
    async () => {
      const { buffer, bounds: exported } = await levelRegionBuild(LEVEL_NAME);
      expect(glbNodeNamesRead(buffer).map((node) => node.name)).not.toContain(volumeName);
      expect(exported.isEmpty()).toBe(false);
      const expected = arrayedBoundsExpected(sourceBounds);
      expect(exported.min.distanceTo(expected.min)).toBeLessThan(BOUNDS_TOLERANCE);
      expect(exported.max.distanceTo(expected.max)).toBeLessThan(BOUNDS_TOLERANCE);
    },
    STEP_TIMEOUT_MILLISECONDS,
  );

  it(
    'cuts the covered half of the box in the running game with a subtractive volume',
    async () => {
      await client.toolCallExpectOk('set_modifier_stack', { id: arrayVolumeId, modifiers: [] });
      const sourceBox = new THREE.Box3(vectorRead(sourceBounds.min), vectorRead(sourceBounds.max));
      await gameRegionBoundsWait(sourceBox, 'the source box without copies');
      const subtractVolume = await subtractVolumeAdd();
      subtractVolumeName = subtractVolume.name;
      expect(subtractVolume.operationIssue).toBe('');
      await gameRegionBoundsWait(cutBoundsExpected(), 'the source box with its +X half cut away');
      expect(await gameEntityNamesRead()).not.toContain(subtractVolumeName);
    },
    STEP_TIMEOUT_MILLISECONDS * 3,
  );

  it(
    'builds a level whose geometry holds the cut box and no subtractive volume',
    async () => {
      const { buffer, bounds: exported } = await levelRegionBuild(LEVEL_NAME_CUT);
      expect(glbNodeNamesRead(buffer).map((node) => node.name)).not.toContain(subtractVolumeName);
      expect(exported.isEmpty()).toBe(false);
      const expected = cutBoundsExpected();
      expect(exported.min.distanceTo(expected.min)).toBeLessThan(BOUNDS_TOLERANCE);
      expect(exported.max.distanceTo(expected.max)).toBeLessThan(BOUNDS_TOLERANCE);
    },
    STEP_TIMEOUT_MILLISECONDS,
  );
});
