import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { McpBounds } from '@/ai/shared/mcp_protocol_types.js';
import { prefabCatalogIdOf } from '@/prefab/ui/prefab_add_menu_section.js';
import { e2eRequiredConfigurationAssert, e2eWindowsShownRead } from '../preview_e2e_environment.js';
import { DesktopE2eAppProcess } from './desktop_e2e_app_process.js';
import { desktopE2eBoundsTopFaceGripPoint } from './desktop_e2e_bounds.js';
import { DesktopE2eMcpClient } from './desktop_e2e_mcp_client.js';
import { desktopE2eWaitUntil } from './desktop_e2e_wait.js';

/**
 * End-to-end acceptance of prefabs in the Entity Browser in the built desktop
 * app: a brush is made into a prefab through the view right-click menu and the
 * name prompt, the prefab's file appears in the project, its tile shows in the
 * Entity Browser, and once the brush is deleted, dragging the tile into the top
 * view places a copy resting on the floor under the drop point, and after a
 * restart the tile is still there. Skipped unless BROOM_E2E_DESKTOP_EXE names
 * the app launcher.
 */
const desktopExecutable = process.env['BROOM_E2E_DESKTOP_EXE'] ? resolve(process.env['BROOM_E2E_DESKTOP_EXE']) : '';
e2eRequiredConfigurationAssert(desktopExecutable !== '', ['BROOM_E2E_DESKTOP_EXE']);
const mcpBasePort = Number(process.env['BROOM_E2E_PREFAB_BROWSER_MCP_PORT'] ?? '19125');
const LAUNCH_TIMEOUT_MILLISECONDS = 90000;
const STEP_TIMEOUT_MILLISECONDS = 60000;

/** Prefab directory relative to the project file. */
const PREFAB_DIRECTORY = 'broom/prefabs';

/** Name typed into the Make Prefab prompt. */
const PREFAB_NAME = 'E2E Kiosk';

/** One tile of a get_entity_browser_tiles reply. */
interface PrefabBrowserE2eTile {
  id: string;
  label: string;
  category: string;
  selected: boolean;
}

/** One menu of a get_open_menus reply. */
interface PrefabBrowserE2eMenu {
  rows: { label: string; enabled: boolean }[];
}

/**
 * Writes a minimal project with a prefab directory into a fresh temporary
 * directory.
 *
 * @returns Project directory and project file.
 */
function projectWrite(): { directory: string; projectFile: string } {
  const directory = mkdtempSync(join(tmpdir(), 'broom-prefab-browser-e2e-'));
  const projectFile = join(directory, 'broom.project.json');
  const project = {
    project_id: `prefab-browser-e2e-${Math.random().toString(36).slice(2, 8)}`,
    name: 'Prefab Browser E2E',
    asset_root: '.',
    level_directory: 'levels',
    prefab_directory: PREFAB_DIRECTORY,
  };
  writeFileSync(projectFile, JSON.stringify(project, null, 2));
  return { directory, projectFile };
}

describe.skipIf(desktopExecutable === '')('desktop prefabs in the Entity Browser end to end', () => {
  const app = new DesktopE2eAppProcess(desktopExecutable, mcpBasePort, e2eWindowsShownRead());
  let client: DesktopE2eMcpClient;
  let project: { directory: string; projectFile: string };
  let prefabId = '';
  let floorTop = 0;
  let kioskBrushId = '';
  let kioskBounds: McpBounds | null = null;

  /** Starts the app, connects the MCP client and opens the project. */
  async function appStartAndProjectOpen(): Promise<void> {
    app.start();
    client = new DesktopE2eMcpClient(await app.mcpUrlWait(LAUNCH_TIMEOUT_MILLISECONDS));
    await client.initialize();
    await desktopE2eWaitUntil(
      'the editor to answer tools',
      async () => ((await client.toolCall('get_editor_context')).ok ? true : null),
      LAUNCH_TIMEOUT_MILLISECONDS,
    );
    await client.toolCallExpectOk('project_open', { path: project.projectFile });
  }

  /**
   * Opens the Entity Browser and waits until it shows the tile of the prefab.
   *
   * @returns The prefab's tile.
   */
  async function prefabTileWait(): Promise<PrefabBrowserE2eTile> {
    await client.toolCallExpectOk('set_main_window', { floatingWindows: { entity_browser: true } });
    return desktopE2eWaitUntil(
      'the prefab tile',
      async () => {
        const read = await client.toolDataExpectOk<{ tiles: PrefabBrowserE2eTile[] }>('get_entity_browser_tiles');
        return read.tiles.find((tile) => tile.id === prefabCatalogIdOf(prefabId)) ?? null;
      },
      STEP_TIMEOUT_MILLISECONDS,
    );
  }

  /**
   * Reads the world bounds of a brush.
   *
   * @param brushId Brush id.
   * @returns World bounds.
   */
  async function brushBoundsRead(brushId: string): Promise<McpBounds> {
    return (await client.toolDataExpectOk<{ worldBounds: McpBounds }>('get_brush', { brushId })).worldBounds;
  }

  /**
   * Deletes every brush the scene starts with, so placement rays meet only the
   * test's floor.
   */
  async function sceneBrushesClear(): Promise<void> {
    const listed = await client.toolDataExpectOk<{ models: { modelId: string }[] }>('list_solid_models');
    const brushIds: string[] = [];
    for (const model of listed.models) {
      const detail = await client.toolDataExpectOk<{ brushes: { brushId: string }[] }>('get_solid_model', {
        modelId: model.modelId,
      });
      brushIds.push(...detail.brushes.map((brush) => brush.brushId));
    }
    if (brushIds.length > 0) {
      await client.toolCallExpectOk('delete_brushes', { brushIds });
    }
  }

  beforeAll(async () => {
    project = projectWrite();
    await appStartAndProjectOpen();
  }, LAUNCH_TIMEOUT_MILLISECONDS * 2);

  afterAll(async () => {
    await app.stop();
    if (project) {
      rmSync(project.directory, { recursive: true, force: true });
    }
  });

  it(
    'makes a prefab from a brush through the right-click menu and the name prompt, as a project file',
    async () => {
      await sceneBrushesClear();
      const created = await client.toolDataExpectOk<{ modelId: string; brushId: string }>('create_solid_model', {
        name: 'Prefab Browser E2E',
      });
      const kiosk = await brushBoundsRead(created.brushId);
      kioskBrushId = created.brushId;
      kioskBounds = kiosk;
      floorTop = kiosk.min.y;
      await client.toolCallExpectOk('add_box_brush', {
        modelId: created.modelId,
        size: { x: 40, y: 1, z: 40 },
        position: { x: 0, y: floorTop - 0.5, z: 0 },
        exact: true,
      });
      await client.toolCallExpectOk('select', { brushIds: [] });
      await client.toolCallExpectOk('viewport_click', {
        view: 'perspective',
        at: desktopE2eBoundsTopFaceGripPoint(kiosk),
        button: 'right',
      });
      const [menu] = await client
        .toolDataExpectOk<{ menus: PrefabBrowserE2eMenu[] }>('get_open_menus')
        .then((read) => read.menus);
      expect(menu?.rows).toContainEqual(expect.objectContaining({ label: 'Make Prefab…', enabled: true }));
      await client.toolCallExpectOk('choose_open_menu_item', { label: 'Make Prefab…' });
      await client.toolCallExpectOk('keyboard_input', { text: PREFAB_NAME });
      await client.toolCallExpectOk('keyboard_input', { code: 'Enter' });
      const listed = await desktopE2eWaitUntil(
        'the prefab to be listed',
        async () => {
          const read = await client.toolDataExpectOk<{ prefabs: { id: string; name: string }[] }>('list_prefabs');
          return read.prefabs.find((prefab) => prefab.name === PREFAB_NAME) ?? null;
        },
        STEP_TIMEOUT_MILLISECONDS,
      );
      prefabId = listed.id;
      const prefabFile = join(project.directory, PREFAB_DIRECTORY, `${prefabId}.json`);
      await desktopE2eWaitUntil(
        'the prefab file',
        async () => (existsSync(prefabFile) ? true : null),
        STEP_TIMEOUT_MILLISECONDS,
      );
    },
    STEP_TIMEOUT_MILLISECONDS * 2,
  );

  it(
    'shows the prefab as a selected tile and places it on the floor where the tile is dropped',
    async () => {
      const tile = await prefabTileWait();
      expect(tile).toMatchObject({ label: PREFAB_NAME, category: 'Prefabs / Prefabs', selected: true });
      const kiosk = kioskBounds ?? { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
      const grid = await client.toolDataExpectOk<{ interval: number }>('get_snap_settings');
      const step = grid.interval > 0 ? grid.interval : 1;
      const kioskCentre = { x: (kiosk.min.x + kiosk.max.x) / 2, z: (kiosk.min.z + kiosk.max.z) / 2 };
      await client.toolCallExpectOk('delete_brushes', { brushIds: [kioskBrushId] });
      const dropAt = { x: kioskCentre.x + 2 * step, y: floorTop, z: kioskCentre.z - step };
      const dropped = await client.toolDataExpectOk<{ selection: { brushIds: string[] } }>('entity_browser_drag', {
        tileId: tile.id,
        view: 'top',
        at: dropAt,
      });
      expect(dropped.selection.brushIds).toHaveLength(1);
      const placed = await brushBoundsRead(dropped.selection.brushIds[0] ?? '');
      expect(placed.min.y).toBeCloseTo(floorTop, 3);
      expect((placed.min.x + placed.max.x) / 2).toBeCloseTo(dropAt.x, 3);
      expect((placed.min.z + placed.max.z) / 2).toBeCloseTo(dropAt.z, 3);
    },
    STEP_TIMEOUT_MILLISECONDS * 2,
  );

  it(
    'still shows the prefab tile after the app restarts',
    async () => {
      await app.stop();
      await appStartAndProjectOpen();
      const tile = await prefabTileWait();
      expect(tile.label).toBe(PREFAB_NAME);
    },
    LAUNCH_TIMEOUT_MILLISECONDS * 2,
  );
});
