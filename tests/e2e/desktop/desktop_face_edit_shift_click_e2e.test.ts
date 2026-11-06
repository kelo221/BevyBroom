import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve } from 'node:path';
import type { McpBounds, McpVec3 } from '@/ai/shared/mcp_protocol_types.js';
import { EditorToolId } from '@/types/editor_tool_id.js';
import { e2eRequiredConfigurationAssert, e2eWindowsShownRead } from '../preview_e2e_environment.js';
import { DesktopE2eAppProcess } from './desktop_e2e_app_process.js';
import { DesktopE2eMcpClient } from './desktop_e2e_mcp_client.js';
import { desktopE2eWaitUntil } from './desktop_e2e_wait.js';
import { desktopE2eBoundsTopFaceGripPoint } from './desktop_e2e_bounds.js';

/**
 * End-to-end acceptance of the object tool Shift+click in the built desktop
 * app: a Shift+click on the top face of a brush in the perspective view
 * switches to the Face tool, opens the Face Edit Sheet and makes exactly that
 * face the face selection. Skipped unless BROOM_E2E_DESKTOP_EXE names the app
 * launcher.
 */
const desktopExecutable = process.env['BROOM_E2E_DESKTOP_EXE'] ? resolve(process.env['BROOM_E2E_DESKTOP_EXE']) : '';
e2eRequiredConfigurationAssert(desktopExecutable !== '', ['BROOM_E2E_DESKTOP_EXE']);
const mcpBasePort = Number(process.env['BROOM_E2E_FACE_EDIT_MCP_PORT'] ?? '19005');
const LAUNCH_TIMEOUT_MILLISECONDS = 90000;
const STEP_TIMEOUT_MILLISECONDS = 60000;

/** One selected face of a get_face_edit_state reply. */
interface FaceEditE2eFace {
  brushId: string;
  faceIndex: number;
  displaced: boolean;
}

/** Data of a get_face_edit_state reply. */
interface FaceEditE2eState {
  activeTool: string | null;
  faceEditSheetOpen: boolean;
  faceEditSheetTab: string;
  faces: FaceEditE2eFace[];
}

/** One plane of a full get_brush reply. */
interface FaceEditE2ePlane {
  normal: McpVec3;
}

/**
 * Finds the plane index whose normal points most along one world axis
 * direction.
 *
 * @param planes Brush planes.
 * @param score Returns how well a normal matches the wanted direction.
 * @returns Face index.
 */
function faceEditE2ePlaneBest(planes: readonly FaceEditE2ePlane[], score: (normal: McpVec3) => number): number {
  let bestIndex = -1;
  planes.forEach((plane, index) => {
    const best = planes[bestIndex];
    if (!best || score(plane.normal) > score(best.normal)) bestIndex = index;
  });
  return bestIndex;
}

describe.skipIf(desktopExecutable === '')('desktop object tool Shift+click face editing end to end', () => {
  const app = new DesktopE2eAppProcess(desktopExecutable, mcpBasePort, e2eWindowsShownRead());
  let client: DesktopE2eMcpClient;

  /** Starts the app and waits until the editor answers tools. */
  async function appLaunch(): Promise<void> {
    app.start();
    client = new DesktopE2eMcpClient(await app.mcpUrlWait(LAUNCH_TIMEOUT_MILLISECONDS));
    await client.initialize();
    await desktopE2eWaitUntil(
      'the editor to answer tools',
      async () => ((await client.toolCall('get_editor_context')).ok ? true : null),
      LAUNCH_TIMEOUT_MILLISECONDS,
    );
  }

  /**
   * Reads the planes of a brush.
   *
   * @param brushId Brush id.
   * @returns Brush planes in face order.
   */
  async function brushPlanesRead(brushId: string): Promise<FaceEditE2ePlane[]> {
    const brush = await client.toolDataExpectOk<{ geometry: { planes: FaceEditE2ePlane[] } }>('get_brush', {
      brushId,
      detail: 'full',
    });
    return brush.geometry.planes;
  }

  /** Deletes every brush of every solid model so the scene holds no solids. */
  async function sceneBrushesDelete(): Promise<void> {
    const listed = await client.toolDataExpectOk<{ models: { modelId: string }[] }>('list_solid_models');
    for (const model of listed.models) {
      const detail = await client.toolDataExpectOk<{ brushes: { brushId: string }[] }>('get_solid_model', {
        modelId: model.modelId,
      });
      const brushIds = detail.brushes.map((brush) => brush.brushId);
      if (brushIds.length > 0) {
        await client.toolCallExpectOk('delete_brushes', { brushIds });
      }
    }
  }

  /**
   * Empties the scene of solids and creates a solid model with its one box
   * brush, the only brush in view.
   *
   * @returns Brush id of the box.
   */
  async function soleBrushCreate(): Promise<string> {
    await sceneBrushesDelete();
    const created = await client.toolDataExpectOk<{ brushId: string }>('create_solid_model', {
      name: `ShiftClickFaceEdit${Date.now()}`,
    });
    return created.brushId;
  }

  beforeAll(async () => {
    await appLaunch();
  }, LAUNCH_TIMEOUT_MILLISECONDS * 2);

  afterAll(async () => {
    await app.stop();
  });

  it(
    'switches to the Face tool, opens the Face Edit Sheet and selects exactly the Shift+clicked face',
    async () => {
      const brushId = await soleBrushCreate();
      const planes = await brushPlanesRead(brushId);
      const topFaceIndex = faceEditE2ePlaneBest(planes, (normal) => normal.y);
      await client.toolCallExpectOk('select', { brushIds: [] });
      const before = await client.toolDataExpectOk<FaceEditE2eState>('get_face_edit_state');
      expect(before.activeTool).toBe(EditorToolId.OBJECT);
      expect(before.faceEditSheetOpen).toBe(false);
      expect(before.faces).toEqual([]);
      const bounds = (await client.toolDataExpectOk<{ worldBounds: McpBounds }>('get_brush', { brushId })).worldBounds;
      const clicked = await client.toolDataExpectOk<{ selection: { brushIds: string[] } }>('viewport_click', {
        view: 'perspective',
        at: desktopE2eBoundsTopFaceGripPoint(bounds),
        keys: { shift: true },
      });
      expect(clicked.selection.brushIds).toEqual([]);
      const state = await desktopE2eWaitUntil(
        'the Face tool to hold the Shift+clicked face',
        async () => {
          const read = await client.toolDataExpectOk<FaceEditE2eState>('get_face_edit_state');
          return read.activeTool === EditorToolId.FACE ? read : null;
        },
        STEP_TIMEOUT_MILLISECONDS,
      );
      expect(state.faceEditSheetOpen).toBe(true);
      expect(state.faces).toEqual([{ brushId, faceIndex: topFaceIndex, displaced: false }]);
    },
    STEP_TIMEOUT_MILLISECONDS * 2,
  );
});
