import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve } from 'node:path';
import { e2eRequiredConfigurationAssert, e2eWindowsShownRead } from '../preview_e2e_environment.js';
import { DesktopE2eAppProcess } from './desktop_e2e_app_process.js';
import { DesktopE2eMcpClient } from './desktop_e2e_mcp_client.js';
import { desktopE2eWaitUntil } from './desktop_e2e_wait.js';

/**
 * End-to-end acceptance of the Clip Plane tool in the built desktop app, driven
 * like a user with real keys and mouse drags: Shift+X opens the tool, a line
 * dragged across the brush in the front view places the plane, Tab cycles the
 * kept side and Enter applies. Side A and Side B keep opposite halves, and Both
 * splits into two brushes. Skipped unless BROOM_E2E_DESKTOP_EXE names the app
 * launcher.
 */
const desktopExecutable = process.env['BROOM_E2E_DESKTOP_EXE'] ? resolve(process.env['BROOM_E2E_DESKTOP_EXE']) : '';
e2eRequiredConfigurationAssert(desktopExecutable !== '', ['BROOM_E2E_DESKTOP_EXE']);
const mcpBasePort = Number(process.env['BROOM_E2E_CLIP_TOOL_MCP_PORT'] ?? '19185');
const LAUNCH_TIMEOUT_MILLISECONDS = 90000;
const STEP_TIMEOUT_MILLISECONDS = 60000;

/** Edge length in meters of the cube the tests cut. */
const CLIP_E2E_CUBE_SIZE = 1;

/**
 * How far past the cube center the dragged cut lines reach, in meters: past the
 * cube faces yet well inside the front view at its default zoom.
 */
const CLIP_E2E_LINE_REACH = 0.75;

/** Plain vector of a tool reply. */
interface ClipE2eVector {
  x: number;
  y: number;
  z: number;
}

/** Brush row of a get_solid_model reply. */
interface ClipE2eBrushRow {
  brushId: string;
  worldBounds: { min: ClipE2eVector; max: ClipE2eVector } | null;
}

describe.skipIf(desktopExecutable === '')('desktop app clip tool end to end', () => {
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
   * Creates a solid model holding only one cube centered at the origin and
   * selects the cube.
   *
   * @param name Model display name.
   * @returns Model id.
   */
  async function cubeModelCreateAndSelect(name: string): Promise<string> {
    const { modelId } = await client.toolDataExpectOk<{ modelId: string }>('create_solid_model', { name });
    const seededBrushIds = (await modelBrushesRead(modelId)).map((brush) => brush.brushId);
    const { brushId } = await client.toolDataExpectOk<{ brushId: string }>('add_box_brush', {
      modelId,
      size: CLIP_E2E_CUBE_SIZE,
      position: { x: 0, y: 0, z: 0 },
    });
    if (seededBrushIds.length > 0) {
      await client.toolCallExpectOk('delete_brushes', { brushIds: seededBrushIds });
    }
    await client.toolCallExpectOk('select', { brushIds: [brushId] });
    return modelId;
  }

  /**
   * Returns the brush rows of a model.
   *
   * @param modelId Solid model uuid.
   * @returns Brush rows.
   */
  async function modelBrushesRead(modelId: string): Promise<ClipE2eBrushRow[]> {
    return (await client.toolDataExpectOk<{ brushes: ClipE2eBrushRow[] }>('get_solid_model', { modelId })).brushes;
  }

  /**
   * Presses one key like a user.
   *
   * @param code Key code.
   * @param shift Whether Shift is held.
   */
  async function keyPress(code: string, shift: boolean = false): Promise<void> {
    await client.toolCallExpectOk('keyboard_input', { code, keys: { shift } });
  }

  /**
   * Opens the clip tool with Shift+X and drags a line across the cube in the
   * front view.
   *
   * @param from World start of the line.
   * @param to World end of the line.
   */
  async function clipLineDrag(from: ClipE2eVector, to: ClipE2eVector): Promise<void> {
    await keyPress('KeyX', true);
    await client.toolCallExpectOk('viewport_drag', { view: 'front', from, to });
  }

  /**
   * Waits until a model holds a number of brushes and returns them.
   *
   * @param modelId Solid model uuid.
   * @param count Expected brush count.
   * @returns Brush rows.
   */
  async function brushesWait(modelId: string, count: number): Promise<ClipE2eBrushRow[]> {
    return desktopE2eWaitUntil(
      `${count} brushes in the model`,
      async () => {
        const brushes = await modelBrushesRead(modelId);
        return brushes.length === count ? brushes : null;
      },
      STEP_TIMEOUT_MILLISECONDS,
    );
  }

  /**
   * Waits until the single brush of a model no longer spans the whole cube in X
   * and returns its world bounds.
   *
   * @param modelId Solid model uuid.
   * @returns World bounds of the clipped brush.
   */
  async function clippedBoundsWait(modelId: string): Promise<{ min: ClipE2eVector; max: ClipE2eVector }> {
    return desktopE2eWaitUntil(
      'the cube to be clipped',
      async () => {
        const [brush] = await modelBrushesRead(modelId);
        const bounds = brush?.worldBounds ?? null;
        return bounds && bounds.max.x - bounds.min.x < CLIP_E2E_CUBE_SIZE - 1e-3 ? bounds : null;
      },
      STEP_TIMEOUT_MILLISECONDS,
    );
  }

  /** Vertical line through the cube center in the front view. */
  const verticalCutFrom = { x: 0, y: CLIP_E2E_LINE_REACH, z: 0 };
  const verticalCutTo = { x: 0, y: -CLIP_E2E_LINE_REACH, z: 0 };

  beforeAll(async () => {
    await appLaunch();
  }, LAUNCH_TIMEOUT_MILLISECONDS * 2);

  afterAll(async () => {
    await app.stop();
  });

  it(
    'keeps opposite halves for Side A and for Side B chosen with Tab',
    async () => {
      const sideAModelId = await cubeModelCreateAndSelect('ClipSideAE2e');
      await clipLineDrag(verticalCutFrom, verticalCutTo);
      await keyPress('Enter');
      const sideA = await clippedBoundsWait(sideAModelId);
      await keyPress('Escape');
      const sideBModelId = await cubeModelCreateAndSelect('ClipSideBE2e');
      await clipLineDrag(verticalCutFrom, verticalCutTo);
      await keyPress('Tab');
      await keyPress('Enter');
      const sideB = await clippedBoundsWait(sideBModelId);
      await keyPress('Escape');
      const halfWidth = CLIP_E2E_CUBE_SIZE / 2;
      expect(sideA.max.x - sideA.min.x).toBeCloseTo(halfWidth, 3);
      expect(sideB.max.x - sideB.min.x).toBeCloseTo(halfWidth, 3);
      expect(sideA.min.x + sideB.min.x).toBeCloseTo(-halfWidth, 3);
    },
    STEP_TIMEOUT_MILLISECONDS,
  );

  it(
    'splits into two brushes on either side of the line when Shift+X cycles to Both',
    async () => {
      const modelId = await cubeModelCreateAndSelect('ClipBothE2e');
      await clipLineDrag({ x: -CLIP_E2E_LINE_REACH, y: 0, z: 0 }, { x: CLIP_E2E_LINE_REACH, y: 0, z: 0 });
      await keyPress('KeyX', true);
      await keyPress('KeyX', true);
      await keyPress('Enter');
      const pieces = await brushesWait(modelId, 2);
      await keyPress('Escape');
      const halfSize = CLIP_E2E_CUBE_SIZE / 2;
      const spans = pieces.map((piece) => [piece.worldBounds?.min.y ?? NaN, piece.worldBounds?.max.y ?? NaN]);
      spans.sort((first, second) => (first[0] ?? 0) - (second[0] ?? 0));
      expect(spans[0]?.[0]).toBeCloseTo(-halfSize, 3);
      expect(spans[0]?.[1]).toBeCloseTo(0, 3);
      expect(spans[1]?.[0]).toBeCloseTo(0, 3);
      expect(spans[1]?.[1]).toBeCloseTo(halfSize, 3);
    },
    STEP_TIMEOUT_MILLISECONDS,
  );
});
