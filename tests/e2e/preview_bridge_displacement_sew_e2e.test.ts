import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { EditorApi } from '@/ai/client/editor_api.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import { GlbExporter } from '@/io/glb/glb_exporter.js';
import { documentIdentityEnsure } from '@/io/document/document_identity.js';
import { PreviewLinkTransportHttp } from '@/preview/link/preview_link_transport.js';
import { displacementRowLength, displacementVertexCount } from '@/displacement/model/displacement_face_surface.js';
import { displacementSurfaceMeshNameBuild } from '@/displacement/mesh/displacement_surface_mesh_keys.js';
import { editorApiTestHostCreate, type EditorApiTestHostParts } from '../ai/client/editor_api_test_host.js';
import { glbNodePositionsRead, glbPositionsCoincidentCountRead } from '../io/glb/glb_node_positions_read.js';
import { PreviewE2eGameProcess, previewE2eProjectCopy, previewE2eProjectRemove } from './preview_e2e_game_process.js';
import { PreviewE2eRig, previewE2eSleep } from './preview_e2e_rig.js';
import { e2eWindowsShownRead, previewE2eEnvironmentRead } from './preview_e2e_environment.js';
import { PREVIEW_E2E_NAME_COMPONENT, previewE2eEntityRowsQuery, previewE2eNameRead } from './preview_e2e_game_query.js';

/**
 * End-to-end acceptance of sewing displacements with different normals: the top
 * face and a side face of one box get noisy displacements through
 * `set_face_displacement`, `sew_displacements` sews them, the live game shows
 * both surfaces, the exported GLB places every vertex of the shared edge of
 * both surfaces at the same point (and did not before the sew), and a game
 * loading that GLB without the editor shows both surfaces. Skipped unless
 * BROOM_E2E_PREVIEW_EXE and BROOM_E2E_PROJECT_DIR are set; its games listen
 * twenty-two and twenty-three ports above BROOM_E2E_PORT.
 */
const environment = previewE2eEnvironmentRead(22);
const shippedEnvironment = previewE2eEnvironmentRead(23);
const STEP_TIMEOUT_MILLISECONDS = 60000;
const SHIPPED_SCENE_PATH = 'shipped/displacement_sew_level.glb';
const SEW_POWER = 2;
const SEW_COINCIDENT_DISTANCE = 1e-4;

/** One face of a full get_brush reply. */
interface SewE2ePlane {
  normal: { x: number; y: number; z: number };
}

/** Brush face named in displacement tool calls. */
interface SewE2eFace {
  brushId: string;
  faceIndex: number;
}

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

describe.skipIf(!environment.isConfigured)('sewing displacements with different normals end to end', () => {
  let projectDirectory = '';
  let game: PreviewE2eGameProcess;
  let parts: EditorApiTestHostParts;
  let api: EditorApi;
  let rig: PreviewE2eRig;
  let faces: SewE2eFace[] = [];
  let surfaceNames: string[] = [];

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
    rig = new PreviewE2eRig(parts.world, environment.endpoint, 'displacement_sew_level');
  });

  afterAll(async () => {
    rig?.controller.disconnect();
    await game?.stop();
    if (projectDirectory !== '') {
      previewE2eProjectRemove(projectDirectory);
    }
  });

  /**
   * Finds the faces of a brush whose planes point most upwards and most along
   * +X.
   *
   * @param brushId Brush id.
   * @returns Upward and side face.
   */
  function topAndSideFacesRead(brushId: string): SewE2eFace[] {
    const brush = toolData<{ geometry: { planes: SewE2ePlane[] } }>(
      api.invokeTool('get_brush', { brushId, detail: 'full' }),
    );
    const planes = brush.geometry.planes;
    const facing = (axis: 'x' | 'y'): number =>
      planes.reduce(
        (best, plane, index) => (plane.normal[axis] > (planes[best]?.normal[axis] ?? -2) ? index : best),
        0,
      );
    return [facing('y'), facing('x')].map((faceIndex) => ({ brushId, faceIndex }));
  }

  /**
   * Gives a face a displacement with offsets that differ per face and vertex.
   *
   * @param face Face to displace.
   * @param faceOrder Position of the face in the face list.
   */
  function noisyDisplacementCreate(face: SewE2eFace, faceOrder: number): void {
    const offsets = Array.from(
      { length: displacementVertexCount(SEW_POWER) },
      (_unused, index) => Math.sin(index * 1.7 + faceOrder * 2.3) * 0.2,
    );
    toolData(api.invokeTool('set_face_displacement', { ...face, action: 'create', power: SEW_POWER, offsets }));
  }

  /**
   * Counts the exported vertices of the first surface that coincide with a
   * vertex of the second surface.
   *
   * @param buffer Exported GLB bytes.
   * @returns Coincident vertex count.
   */
  function exportedCoincidentCountRead(buffer: ArrayBuffer): number {
    const [first, second] = surfaceNames.map((name) => glbNodePositionsRead(buffer, name));
    if (!first || !second) throw new Error('surface positions missing');
    return glbPositionsCoincidentCountRead(first, second, SEW_COINCIDENT_DISTANCE);
  }

  /**
   * Returns whether a game shows an entity named after every surface.
   *
   * @param transport Transport to the game.
   * @returns True when every surface name is shown.
   */
  async function surfacesShownIs(transport: PreviewLinkTransportHttp): Promise<boolean> {
    const rows = await previewE2eEntityRowsQuery(transport, [PREVIEW_E2E_NAME_COMPONENT]);
    const names = new Set(rows.map((row) => previewE2eNameRead(row.components[PREVIEW_E2E_NAME_COMPONENT])));
    return surfaceNames.every((name) => names.has(name));
  }

  /** Keeps the editor link updating until the live game shows every surface. */
  async function liveSurfacesWait(): Promise<void> {
    const end = performance.now() + STEP_TIMEOUT_MILLISECONDS;
    while (performance.now() < end) {
      await rig.run(250);
      if (await surfacesShownIs(rig.transport).catch(() => false)) {
        return;
      }
    }
    throw new Error(`Timed out waiting for ${surfaceNames.join(', ')}; link error: ${rig.controller.lastErrorRead()}`);
  }

  it(
    'displaces the top and a side face of one box and exports an open seam before sewing',
    async () => {
      await rig.until('the live game', (view) => rig.isCaughtUp(view), STEP_TIMEOUT_MILLISECONDS);
      const created = toolData<{ brushId: string }>(api.invokeTool('create_solid_model', { name: 'SewBox' }));
      faces = topAndSideFacesRead(created.brushId);
      expect(new Set(faces.map((face) => face.faceIndex)).size).toBe(2);
      faces.forEach((face, faceOrder) => noisyDisplacementCreate(face, faceOrder));
      surfaceNames = faces.map((face) =>
        displacementSurfaceMeshNameBuild({ brushId: face.brushId, surfaceIndex: face.faceIndex }),
      );
      await liveSurfacesWait();
      const unsewnBuffer = await new GlbExporter().exportForFile(parts.world);
      expect(exportedCoincidentCountRead(unsewnBuffer)).toBeLessThan(displacementRowLength(SEW_POWER));
    },
    STEP_TIMEOUT_MILLISECONDS * 2,
  );

  it(
    'sews the seam so every shared edge vertex of both exported surfaces coincides',
    async () => {
      const sewn = toolData<{ sewnCount: number }>(api.invokeTool('sew_displacements', { faces }));
      expect(sewn.sewnCount).toBe(2);
      await liveSurfacesWait();
      const shippedBuffer = await new GlbExporter().exportForFile(parts.world);
      expect(exportedCoincidentCountRead(shippedBuffer)).toBe(displacementRowLength(SEW_POWER));
      const shippedFile = join(projectDirectory, 'assets', SHIPPED_SCENE_PATH);
      mkdirSync(dirname(shippedFile), { recursive: true });
      writeFileSync(shippedFile, new Uint8Array(shippedBuffer));
    },
    STEP_TIMEOUT_MILLISECONDS * 2,
  );

  it(
    'shows both sewn surfaces in a game that loads the exported level without the editor',
    async () => {
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
        const transport = new PreviewLinkTransportHttp(shippedEnvironment.endpoint);
        const end = performance.now() + STEP_TIMEOUT_MILLISECONDS;
        while (performance.now() < end) {
          if (await surfacesShownIs(transport).catch(() => false)) {
            return;
          }
          await previewE2eSleep(250);
        }
        throw new Error(`Timed out waiting for the shipped surfaces ${surfaceNames.join(', ')}`);
      } finally {
        await shippedGame.stop();
        previewE2eProjectRemove(shippedProject);
      }
    },
    STEP_TIMEOUT_MILLISECONDS * 2,
  );
});
