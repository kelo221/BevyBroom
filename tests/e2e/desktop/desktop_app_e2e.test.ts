import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve } from 'node:path';
import type { McpBounds, McpToolResult, McpVec3 } from '@/ai/shared/mcp_protocol_types.js';
import type { SceneJSON } from '@/io/scene/io_types.js';
import { PreviewLinkTransportHttp } from '@/preview/link/preview_link_transport.js';
import type { PreviewBridgeStatus } from '@/preview/protocol/preview_protocol_types.js';
import { PreviewE2eGameProcess, previewE2eProjectCopy, previewE2eProjectRemove } from '../preview_e2e_game_process.js';
import { e2eWindowsShownRead, previewE2eEnvironmentRead } from '../preview_e2e_environment.js';
import {
  PREVIEW_E2E_DYNAMIC_LIGHT_COMPONENT,
  PREVIEW_E2E_LIGHT_EFFECT_COMPONENT,
  PREVIEW_E2E_VOLUMETRIC_LIGHT_COMPONENT,
  previewE2eEntityRowsQuery,
  previewE2eOnlyPortalClosedIs,
} from '../preview_e2e_game_query.js';
import {
  PREVIEW_E2E_DOOR_COMPONENT,
  PREVIEW_E2E_DOOR_STATS_ASSET,
  PREVIEW_E2E_GAME_ENTITY_COMPONENT,
  previewE2eObjectComponentRead,
} from '../preview_e2e_game_components.js';
import { DesktopE2eAppProcess } from './desktop_e2e_app_process.js';
import { DesktopE2eMcpClient } from './desktop_e2e_mcp_client.js';
import { desktopE2eWaitUntil } from './desktop_e2e_wait.js';
import { shellMenusBuiltinCreate } from '@/layout/shell/menubar/shell_menu_bar.js';
import type { ShellMainWindowState } from '@/layout/shell/actions/shell_main_window_control.js';

/**
 * End-to-end acceptance of the built desktop app, driven through its MCP server
 * the way an AI client drives it. Skipped unless BROOM_E2E_DESKTOP_EXE names
 * the app launcher (for example
 * desktop_build/dev-win-x64/BevyBroom-dev/bin/launcher.exe). When
 * BROOM_E2E_PREVIEW_EXE and BROOM_E2E_PROJECT_DIR are set as well, the game
 * preview is started too and the app is checked against it.
 */
const desktopExecutable = process.env['BROOM_E2E_DESKTOP_EXE'] ? resolve(process.env['BROOM_E2E_DESKTOP_EXE']) : '';
const mcpBasePort = Number(process.env['BROOM_E2E_MCP_PORT'] ?? '18865');
const previewEnvironment = previewE2eEnvironmentRead(2);
const LAUNCH_TIMEOUT_MILLISECONDS = 90000;
const STEP_TIMEOUT_MILLISECONDS = 60000;
const HALL_SIZE = { x: 6, y: 3, z: 6 };
const WALL_THICKNESS = 0.2;
const DOOR_SIZE = { width: 1.2, height: 2.2 };
const LIGHT_FEATURE_SETTINGS = { effectKind: 'candle', fogEnabled: true, fogShape: 'sphere' };

/** Game preview view returned by the preview_status tool. */
interface DesktopE2ePreviewStatus {
  connection: string;
  revisions: { state: number; geometry: number } | null;
  game: PreviewBridgeStatus | null;
  lastError: string;
}

/** One console line returned by the console_read tool. */
interface DesktopE2eConsoleLine {
  level: string;
  text: string;
}

/** One issue returned by the issues_list tool. */
interface DesktopE2eIssue {
  objectId: string | null;
  provider: string;
  description: string;
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
 * Returns a point on the top face of world bounds halfway between the face
 * center and its +X +Z corner. Pressing there grabs the box itself, clear of
 * the bounds resize handle at the face center.
 *
 * @param bounds World bounds of a box.
 * @returns World point on the top face.
 */
function boundsTopFaceGripPoint(bounds: McpBounds): McpVec3 {
  return {
    x: (bounds.min.x + 3 * bounds.max.x) / 4,
    y: bounds.max.y,
    z: (bounds.min.z + 3 * bounds.max.z) / 4,
  };
}

/**
 * Counts the scene file entries of each type.
 *
 * @param json Scene file text.
 * @returns Entry count per type.
 */
function sceneEntryTypesCount(json: string): Record<string, number> {
  const scene = JSON.parse(json) as SceneJSON;
  const counts: Record<string, number> = {};
  scene.objects.forEach((entry) => {
    counts[entry.type] = (counts[entry.type] ?? 0) + 1;
  });
  return counts;
}

/**
 * Returns whether the game shows exactly what the editor sent: both rooms, the
 * portal with culling on, and the one light.
 *
 * @param status Preview status reported by the editor.
 * @returns True when the game is caught up and complete.
 */
function isGameShowingTheHalls(status: DesktopE2ePreviewStatus): boolean {
  const game = status.game;
  const sent = status.revisions;
  if (!game || !sent || sent.geometry === 0) {
    return false;
  }
  const isCaughtUp =
    game.state_revision_applied === sent.state &&
    game.geometry_revision_applied === sent.geometry &&
    !game.geometry_loading;
  return (
    isCaughtUp &&
    game.room_count === 2 &&
    game.portal_count === 1 &&
    game.portal_state === 'active' &&
    game.light_count === 1
  );
}

describe.skipIf(desktopExecutable === '')('desktop app end to end', () => {
  const app = new DesktopE2eAppProcess(desktopExecutable, mcpBasePort, e2eWindowsShownRead());
  let client: DesktopE2eMcpClient;
  let game: PreviewE2eGameProcess | null = null;
  let projectDirectory = '';
  let portalId = '';
  let lightId = '';

  /**
   * Starts the app, connects an MCP client to it and waits until the editor
   * answers tools.
   */
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
   * Connects the editor to the game and waits until the game shows the halls.
   *
   * @returns The matching preview status.
   */
  async function gameShowingTheHallsWait(): Promise<DesktopE2ePreviewStatus> {
    await client.toolCallExpectOk('preview_connect', { endpoint: previewEnvironment.endpoint });
    return desktopE2eWaitUntil(
      'the game to show both halls',
      async () => {
        const status = toolDataRead<DesktopE2ePreviewStatus>(await client.toolCallExpectOk('preview_status'));
        return isGameShowingTheHalls(status) ? status : null;
      },
      STEP_TIMEOUT_MILLISECONDS,
    );
  }

  /**
   * Adds a hall shell and cuts a door into its wall on the shared side.
   *
   * @param modelId Solid model id.
   * @param name Hall name prefix.
   * @param centerX Hall center along X.
   * @param doorWallName Name suffix of the wall that gets the door.
   */
  async function hallWithDoorAdd(modelId: string, name: string, centerX: number, doorWallName: string): Promise<void> {
    const position = { x: centerX, y: HALL_SIZE.y / 2, z: 0 };
    const shellArgs = {
      modelId,
      name,
      size: HALL_SIZE,
      position,
      wallThickness: WALL_THICKNESS,
      floorThickness: WALL_THICKNESS,
    };
    await client.toolCallExpectOk('add_room_shell', { ...shellArgs, snap: false });
    const found = await client.toolCallExpectOk('find_brushes', { modelId, nameContains: `${name}_${doorWallName}` });
    const wall = toolDataRead<{ brushes: Array<{ brushId: string }> }>(found).brushes[0];
    expect(wall).toBeDefined();
    const door = { modelId, kind: 'door', targetBrushId: wall?.brushId, size: DOOR_SIZE, sillHeight: WALL_THICKNESS };
    await client.toolCallExpectOk('add_opening', {
      ...door,
      position: { x: HALL_SIZE.x / 2, y: 0, z: 0 },
      snap: false,
    });
  }

  /**
   * Reads the newest editor console lines.
   *
   * @returns Console lines, oldest first.
   */
  async function consoleLinesRead(): Promise<DesktopE2eConsoleLine[]> {
    const result = await client.toolCallExpectOk('console_read', { limit: 1000 });
    return toolDataRead<{ lines: DesktopE2eConsoleLine[] }>(result).lines;
  }

  /**
   * Changes the main window arrangement and returns the arrangement the editor
   * reports afterwards.
   *
   * @param changes Docks, tabs and bars to change.
   * @returns Main window arrangement read back from the editor.
   */
  async function mainWindowChange(changes: Partial<ShellMainWindowState>): Promise<ShellMainWindowState> {
    await client.toolCallExpectOk('set_main_window', changes);
    return toolDataRead<ShellMainWindowState>(await client.toolCallExpectOk('get_main_window'));
  }

  /**
   * Validates the map and reads its issues.
   *
   * @returns Issues of the open map.
   */
  async function issuesRead(): Promise<DesktopE2eIssue[]> {
    return toolDataRead<{ issues: DesktopE2eIssue[] }>(await client.toolCallExpectOk('issues_list')).issues;
  }

  beforeAll(async () => {
    if (previewEnvironment.isConfigured) {
      projectDirectory = previewE2eProjectCopy(previewEnvironment.sourceProjectDirectory);
      game = new PreviewE2eGameProcess(
        previewEnvironment.previewExecutable,
        projectDirectory,
        previewEnvironment.bridgePort,
        e2eWindowsShownRead(),
      );
      game.start();
    }
    await appLaunch();
  }, LAUNCH_TIMEOUT_MILLISECONDS * 2);

  afterAll(async () => {
    await app.stop();
    await game?.stop();
    if (projectDirectory !== '') {
      previewE2eProjectRemove(projectDirectory);
    }
  });

  it(
    'answers editor tools over MCP and starts from an empty scene',
    async () => {
      const document = toolDataRead<{ json: string }>(await client.toolCallExpectOk('get_scene_document'));
      const emptyScene = { ...(JSON.parse(document.json) as SceneJSON), objects: [] };
      await client.toolCallExpectOk('load_scene_document', { json: JSON.stringify(emptyScene) });
      const emptied = toolDataRead<{ json: string }>(await client.toolCallExpectOk('get_scene_document'));
      expect(sceneEntryTypesCount(emptied.json)).toEqual({});
    },
    STEP_TIMEOUT_MILLISECONDS,
  );

  it(
    'shows the map editor main window and switches its docks over MCP',
    async () => {
      const initial = toolDataRead<ShellMainWindowState>(await client.toolCallExpectOk('get_main_window'));
      expect(initial.menus).toEqual(shellMenusBuiltinCreate().map((menu) => menu.label));
      const faceAndIssues = await mainWindowChange({ inspectorTab: 'face', infoPanelTab: 'issues' });
      expect(faceAndIssues).toMatchObject({ inspectorTab: 'face', inspectorVisible: true, infoPanelTab: 'issues' });
      const infoPanelHidden = await mainWindowChange({ infoPanelVisible: false, toolbarVisible: false });
      expect(infoPanelHidden).toMatchObject({ infoPanelVisible: false, toolbarVisible: false });
      const restored = await mainWindowChange({
        inspectorTab: initial.inspectorTab,
        infoPanelTab: initial.infoPanelTab,
        infoPanelVisible: initial.infoPanelVisible,
        toolbarVisible: initial.toolbarVisible,
      });
      expect(restored).toEqual(initial);
    },
    STEP_TIMEOUT_MILLISECONDS,
  );

  it(
    'builds two halls joined by a doorway and takes a picture of them',
    async () => {
      const model = await client.toolCallExpectOk('create_solid_model', { name: 'Halls' });
      const modelId = toolDataRead<{ modelId: string }>(model).modelId;
      await hallWithDoorAdd(modelId, 'hall_a', 0, 'wall_right');
      await hallWithDoorAdd(modelId, 'hall_b', HALL_SIZE.x, 'wall_left');
      const picture = await client.toolCallExpectOk('capture_view', {});
      expect(picture.images?.[0]?.data.length ?? 0).toBeGreaterThan(0);
    },
    STEP_TIMEOUT_MILLISECONDS,
  );

  it(
    'adds a room per hall, a doorway portal and a light',
    async () => {
      const halfSize = { halfSizeX: HALL_SIZE.x / 2, halfSizeY: HALL_SIZE.y / 2, halfSizeZ: HALL_SIZE.z / 2 };
      for (const centerX of [0, HALL_SIZE.x]) {
        await client.toolCallExpectOk('add_room', {
          position: { x: centerX, y: HALL_SIZE.y / 2, z: 0 },
          settings: halfSize,
        });
      }
      const portal = await client.toolCallExpectOk('add_portal', {
        name: 'Doorway',
        position: { x: HALL_SIZE.x / 2, y: WALL_THICKNESS + DOOR_SIZE.height / 2, z: 0 },
        rotationDegrees: { x: 0, y: 90, z: 0 },
        settings: { width: DOOR_SIZE.width, height: DOOR_SIZE.height },
      });
      portalId = toolDataRead<{ id: string }>(portal).id;
      const light = await client.toolCallExpectOk('add_light', {
        position: { x: 0, y: HALL_SIZE.y / 2, z: 0 },
        settings: LIGHT_FEATURE_SETTINGS,
      });
      lightId = toolDataRead<{ id: string }>(light).id;
      const document = toolDataRead<{ json: string }>(await client.toolCallExpectOk('get_scene_document'));
      expect(sceneEntryTypesCount(document.json)).toMatchObject({ room: 2, portal: 1, light: 1 });
    },
    STEP_TIMEOUT_MILLISECONDS,
  );

  it(
    'lists an emptied solid model in the issues and its creation in the console, until it is undone',
    async () => {
      const probeName = `IssueProbe${Date.now()}`;
      const created = await client.toolCallExpectOk('create_solid_model', { name: probeName });
      const { modelId, brushId } = toolDataRead<{ modelId: string; brushId: string }>(created);
      await client.toolCallExpectOk('delete_brushes', { brushIds: [brushId] });
      const issue = await desktopE2eWaitUntil(
        'the emptied solid model to be listed as an issue',
        async () => (await issuesRead()).find((entry) => entry.objectId === modelId) ?? null,
        STEP_TIMEOUT_MILLISECONDS,
      );
      expect(issue.provider).toBe('solid_model_warnings');
      await desktopE2eWaitUntil(
        'the solid model creation to reach the console',
        async () => ((await consoleLinesRead()).some((line) => line.text.includes(probeName)) ? true : null),
        STEP_TIMEOUT_MILLISECONDS,
      );
      await client.toolCallExpectOk('undo');
      await client.toolCallExpectOk('undo');
      expect((await issuesRead()).some((entry) => entry.objectId === modelId)).toBe(false);
    },
    STEP_TIMEOUT_MILLISECONDS * 2,
  );

  it.skipIf(!previewEnvironment.isConfigured)(
    'mirrors the halls into the running game with portal culling on',
    async () => {
      const status = await gameShowingTheHallsWait();
      expect(status.game?.portal_message).toBeNull();
    },
    STEP_TIMEOUT_MILLISECONDS,
  );

  it.skipIf(!previewEnvironment.isConfigured)(
    'logs the game preview connection in the console',
    async () => {
      const line = await desktopE2eWaitUntil(
        'the game preview connection to reach the console',
        async () =>
          (await consoleLinesRead()).find((entry) => entry.text.startsWith('Game preview connected to')) ?? null,
        STEP_TIMEOUT_MILLISECONDS,
      );
      expect(line.level).toBe('info');
      expect(line.text).toContain(previewEnvironment.endpoint);
    },
    STEP_TIMEOUT_MILLISECONDS,
  );

  it.skipIf(!previewEnvironment.isConfigured)(
    'closes and opens the doorway in the running game',
    async () => {
      const transport = new PreviewLinkTransportHttp(previewEnvironment.endpoint);
      for (const closed of [true, false]) {
        await client.toolCallExpectOk('set_portal_settings', { id: portalId, settings: { closed } });
        await desktopE2eWaitUntil(
          `the doorway to be ${closed ? 'closed' : 'open'} in the game`,
          async () => ((await previewE2eOnlyPortalClosedIs(transport, closed)) ? true : null),
          STEP_TIMEOUT_MILLISECONDS,
        );
      }
    },
    STEP_TIMEOUT_MILLISECONDS * 2,
  );

  it.skipIf(!previewEnvironment.isConfigured)(
    'shows the effect and fog of a light added through MCP in the game, and removes them',
    async () => {
      const transport = new PreviewLinkTransportHttp(previewEnvironment.endpoint);
      const featureComponents = [PREVIEW_E2E_LIGHT_EFFECT_COMPONENT, PREVIEW_E2E_VOLUMETRIC_LIGHT_COMPONENT];
      for (const isShown of [true, false]) {
        if (!isShown) {
          await client.toolCallExpectOk('set_light_settings', {
            id: lightId,
            settings: { effectKind: 'steady', fogEnabled: false },
          });
        }
        await desktopE2eWaitUntil(
          `the light ${isShown ? 'with' : 'without'} its effect and fog in the game`,
          async () => {
            const rows = await previewE2eEntityRowsQuery(
              transport,
              [PREVIEW_E2E_DYNAMIC_LIGHT_COMPONENT],
              featureComponents,
            ).catch(() => []);
            const isMatching = featureComponents.every((component) => rows[0]?.has?.[component] === isShown);
            return rows.length === 1 && isMatching ? true : null;
          },
          STEP_TIMEOUT_MILLISECONDS,
        );
      }
    },
    STEP_TIMEOUT_MILLISECONDS * 2,
  );

  it.skipIf(!previewEnvironment.isConfigured)(
    'places a game entity through MCP that the running game receives with its overrides',
    async () => {
      await desktopE2eWaitUntil(
        'the game classes to reach the editor',
        async () => {
          const listed = toolDataRead<{ classes: Array<{ type_path: string }> }>(
            await client.toolCallExpectOk('list_game_classes'),
          );
          return listed.classes.some((gameClass) => gameClass.type_path === PREVIEW_E2E_DOOR_COMPONENT) ? true : null;
        },
        STEP_TIMEOUT_MILLISECONDS,
      );
      const added = await client.toolCallExpectOk('add_game_entity', {
        class: PREVIEW_E2E_DOOR_COMPONENT,
        position: { x: 0, y: 0, z: HALL_SIZE.z / 4 },
        fields: { key_name: 'desktop' },
      });
      const entityId = toolDataRead<{ id: string }>(added).id;
      const transport = new PreviewLinkTransportHttp(previewEnvironment.endpoint);
      await desktopE2eWaitUntil(
        'the door to reach the game',
        async () => {
          const door = await previewE2eObjectComponentRead(
            transport,
            PREVIEW_E2E_GAME_ENTITY_COMPONENT,
            entityId,
            PREVIEW_E2E_DOOR_COMPONENT,
          ).catch(() => null);
          return door?.['key_name'] === 'desktop' ? true : null;
        },
        STEP_TIMEOUT_MILLISECONDS,
      );
    },
    STEP_TIMEOUT_MILLISECONDS * 2,
  );

  it.skipIf(!previewEnvironment.isConfigured)(
    'reads a data asset file of the running game through MCP',
    async () => {
      const listed = toolDataRead<{ assetTypes: Array<{ type_path: string; paths: string[] }> }>(
        await client.toolCallExpectOk('list_game_classes'),
      );
      const path = listed.assetTypes.find((assetType) => assetType.type_path === PREVIEW_E2E_DOOR_STATS_ASSET)
        ?.paths[0];
      expect(path).toBeDefined();
      const read = toolDataRead<{ path: string; typePath: string; values: Record<string, unknown> }>(
        await client.toolCallExpectOk('read_data_asset', { path }),
      );
      expect(read.path).toBe(path);
      expect(read.typePath).toBe(PREVIEW_E2E_DOOR_STATS_ASSET);
      expect(typeof read.values).toBe('object');
    },
    STEP_TIMEOUT_MILLISECONDS,
  );

  it(
    'reopens the saved scene after a relaunch as the same document without duplicates',
    async () => {
      const saved = toolDataRead<{ documentId: string; json: string }>(
        await client.toolCallExpectOk('get_scene_document'),
      );
      await app.stop();
      await appLaunch();
      await client.toolCallExpectOk('load_scene_document', { json: saved.json });
      const reopened = toolDataRead<{ documentId: string; json: string }>(
        await client.toolCallExpectOk('get_scene_document'),
      );
      expect(reopened.documentId).toBe(saved.documentId);
      expect(sceneEntryTypesCount(reopened.json)).toEqual(sceneEntryTypesCount(saved.json));
      if (previewEnvironment.isConfigured) {
        expect((await gameShowingTheHallsWait()).game?.document_id).toBe(saved.documentId);
      }
    },
    LAUNCH_TIMEOUT_MILLISECONDS * 2 + STEP_TIMEOUT_MILLISECONDS,
  );

  it(
    'draws a box brush and moves it with mouse drags in the perspective view over MCP',
    async () => {
      await client.toolCallExpectOk('select', { brushIds: [] });
      const drawn = await client.toolCallExpectOk('viewport_drag', {
        view: 'perspective',
        from: { x: -HALL_SIZE.x / 6, y: WALL_THICKNESS, z: -HALL_SIZE.z / 6 },
        to: { x: HALL_SIZE.x / 6, y: WALL_THICKNESS, z: HALL_SIZE.z / 6 },
      });
      const brushId = toolDataRead<{ selection: { brushIds: string[] } }>(drawn).selection.brushIds[0] ?? '';
      expect(brushId).not.toBe('');
      const before = toolDataRead<{ position: McpVec3; worldBounds: McpBounds }>(
        await client.toolCallExpectOk('get_brush', { brushId }),
      );
      for (const axis of ['x', 'y', 'z'] as const) {
        expect(before.worldBounds.max[axis]).toBeGreaterThan(before.worldBounds.min[axis]);
      }
      const grip = boundsTopFaceGripPoint(before.worldBounds);
      const moveDistance = before.worldBounds.max.x - before.worldBounds.min.x;
      await client.toolCallExpectOk('viewport_drag', {
        view: 'perspective',
        from: grip,
        to: { ...grip, x: grip.x + moveDistance },
      });
      const after = toolDataRead<{ position: McpVec3 }>(await client.toolCallExpectOk('get_brush', { brushId }));
      expect(after.position.x).toBeCloseTo(before.position.x + moveDistance, 4);
      expect(after.position.y).toBeCloseTo(before.position.y, 4);
      expect(after.position.z).toBeCloseTo(before.position.z, 4);
      await client.toolCallExpectOk('undo');
      await client.toolCallExpectOk('undo');
      expect((await client.toolCall('get_brush', { brushId })).ok).toBe(false);
    },
    STEP_TIMEOUT_MILLISECONDS,
  );

  it(
    'copies a brush and pastes it at its original position as a new brush that undo removes',
    async () => {
      const created = await client.toolCallExpectOk('create_solid_model', { name: `CopyProbe${Date.now()}` });
      const { brushId } = toolDataRead<{ brushId: string }>(created);
      await client.toolCallExpectOk('select', { brushIds: [brushId] });
      const copied = toolDataRead<{ text: string; count: number }>(await client.toolCallExpectOk('copy_selection'));
      expect(copied.count).toBe(1);
      const pasted = toolDataRead<{ ids: string[] }>(
        await client.toolCallExpectOk('paste_objects', { text: copied.text, atOriginalPosition: true }),
      );
      expect(pasted.ids).toHaveLength(1);
      const pastedId = pasted.ids[0] ?? '';
      expect(pastedId).not.toBe(brushId);
      const sourceBounds = toolDataRead<{ worldBounds: McpBounds }>(
        await client.toolCallExpectOk('get_brush', { brushId }),
      ).worldBounds;
      const pastedBounds = toolDataRead<{ worldBounds: McpBounds }>(
        await client.toolCallExpectOk('get_brush', { brushId: pastedId }),
      ).worldBounds;
      for (const axis of ['x', 'y', 'z'] as const) {
        expect(pastedBounds.min[axis]).toBeCloseTo(sourceBounds.min[axis], 4);
        expect(pastedBounds.max[axis]).toBeCloseTo(sourceBounds.max[axis], 4);
      }
      await client.toolCallExpectOk('undo');
      expect((await client.toolCall('get_brush', { brushId: pastedId })).ok).toBe(false);
      expect((await client.toolCall('get_brush', { brushId })).ok).toBe(true);
    },
    STEP_TIMEOUT_MILLISECONDS,
  );
});
