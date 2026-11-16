import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve } from 'node:path';
import type { McpBounds } from '@/ai/shared/mcp_protocol_types.js';
import { e2eRequiredConfigurationAssert, e2eWindowsShownRead } from '../preview_e2e_environment.js';
import { DesktopE2eAppProcess } from './desktop_e2e_app_process.js';
import { DesktopE2eMcpClient } from './desktop_e2e_mcp_client.js';
import { desktopE2eWaitUntil } from './desktop_e2e_wait.js';
import { desktopE2eBoundsTopFaceGripPoint } from './desktop_e2e_bounds.js';

/**
 * End-to-end acceptance of the fewer-layers commands in the built desktop app:
 * a right click on a brush opens the right-click menu with the commands that
 * apply and runs a chosen one, the Hollow shortcut hollows the selected brush,
 * and the command search opens from its shortcut, finds a command by typing and
 * runs it with Enter. Skipped unless BROOM_E2E_DESKTOP_EXE names the app
 * launcher.
 */
const desktopExecutable = process.env['BROOM_E2E_DESKTOP_EXE'] ? resolve(process.env['BROOM_E2E_DESKTOP_EXE']) : '';
e2eRequiredConfigurationAssert(desktopExecutable !== '', ['BROOM_E2E_DESKTOP_EXE']);
const mcpBasePort = Number(process.env['BROOM_E2E_COMMANDS_MCP_PORT'] ?? '19085');
const LAUNCH_TIMEOUT_MILLISECONDS = 90000;
const STEP_TIMEOUT_MILLISECONDS = 60000;

/** One row of a get_open_menus reply. */
interface CommandsE2eRow {
  label: string;
  shortcut: string;
  enabled: boolean;
  path?: string;
  active?: boolean;
}

/** One menu of a get_open_menus reply. */
interface CommandsE2eMenu {
  kind: 'menu' | 'command_search';
  rows: CommandsE2eRow[];
  query?: string;
}

/** Selection part of a get_selection reply. */
interface CommandsE2eSelection {
  brushIds: string[];
}

describe.skipIf(desktopExecutable === '')(
  'desktop command search, right-click menu and CSG shortcuts end to end',
  () => {
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
     * Lists the brush ids of every solid model in the scene.
     *
     * @returns Brush ids.
     */
    async function sceneBrushIdsRead(): Promise<string[]> {
      const listed = await client.toolDataExpectOk<{ models: { modelId: string }[] }>('list_solid_models');
      const brushIds: string[] = [];
      for (const model of listed.models) {
        const detail = await client.toolDataExpectOk<{ brushes: { brushId: string }[] }>('get_solid_model', {
          modelId: model.modelId,
        });
        brushIds.push(...detail.brushes.map((brush) => brush.brushId));
      }
      return brushIds;
    }

    /**
     * Empties the scene of brushes and creates a solid model with one box
     * brush.
     *
     * @returns Brush id of the box.
     */
    async function soleBrushCreate(): Promise<string> {
      const existing = await sceneBrushIdsRead();
      if (existing.length > 0) {
        await client.toolCallExpectOk('delete_brushes', { brushIds: existing });
      }
      const created = await client.toolDataExpectOk<{ brushId: string }>('create_solid_model', {
        name: `Commands${Date.now()}`,
      });
      return created.brushId;
    }

    /**
     * Reads the open menus.
     *
     * @returns Open menus.
     */
    async function openMenusRead(): Promise<CommandsE2eMenu[]> {
      return (await client.toolDataExpectOk<{ menus: CommandsE2eMenu[] }>('get_open_menus')).menus;
    }

    /**
     * Waits until the scene holds a brush count that satisfies a check.
     *
     * @param description What the wait is for.
     * @param isReached Check on the brush ids.
     * @returns Brush ids once the check passes.
     */
    async function brushIdsWait(description: string, isReached: (brushIds: string[]) => boolean): Promise<string[]> {
      return desktopE2eWaitUntil(
        description,
        async () => {
          const brushIds = await sceneBrushIdsRead();
          return isReached(brushIds) ? brushIds : null;
        },
        STEP_TIMEOUT_MILLISECONDS,
      );
    }

    beforeAll(async () => {
      await appLaunch();
    }, LAUNCH_TIMEOUT_MILLISECONDS * 2);

    afterAll(async () => {
      await app.stop();
    });

    it(
      'right-clicking an unselected brush selects it and opens a menu whose Duplicate row duplicates it',
      async () => {
        const brushId = await soleBrushCreate();
        await client.toolCallExpectOk('select', { brushIds: [] });
        const bounds = (await client.toolDataExpectOk<{ worldBounds: McpBounds }>('get_brush', { brushId }))
          .worldBounds;
        const clicked = await client.toolDataExpectOk<{ selection: CommandsE2eSelection }>('viewport_click', {
          view: 'perspective',
          at: desktopE2eBoundsTopFaceGripPoint(bounds),
          button: 'right',
        });
        expect(clicked.selection.brushIds).toEqual([brushId]);
        const [menu] = await openMenusRead();
        const labels = menu?.rows.map((row) => row.label) ?? [];
        expect(menu?.kind).toBe('menu');
        expect(labels).toEqual(expect.arrayContaining(['Duplicate', 'Delete', 'Hollow', 'Object Properties']));
        expect(labels).not.toContain('Union');
        await client.toolCallExpectOk('choose_open_menu_item', { label: 'Duplicate' });
        await brushIdsWait('the duplicate brush', (brushIds) => brushIds.length === 2);
        expect(await openMenusRead()).toEqual([]);
      },
      STEP_TIMEOUT_MILLISECONDS * 2,
    );

    it(
      'hollows the selected brush from the Hollow shortcut',
      async () => {
        const brushId = await soleBrushCreate();
        await client.toolCallExpectOk('select', { brushIds: [brushId] });
        const pressed = await client.toolDataExpectOk<{ handled: boolean }>('keyboard_input', {
          code: 'KeyO',
          keys: { ctrl: true, shift: true },
        });
        expect(pressed.handled).toBe(true);
        const hollowBrushIds = await brushIdsWait('the hollow walls', (brushIds) => brushIds.length > 1);
        expect(hollowBrushIds).not.toContain(brushId);
      },
      STEP_TIMEOUT_MILLISECONDS * 2,
    );

    it(
      'opens the command search from its shortcut, finds Select All by typing and runs it with Enter',
      async () => {
        await soleBrushCreate();
        await client.toolCallExpectOk('select', { brushIds: [] });
        await client.toolCallExpectOk('keyboard_input', { code: 'KeyP', keys: { ctrl: true, shift: true } });
        await client.toolCallExpectOk('keyboard_input', { text: 'select all' });
        const [search] = await openMenusRead();
        expect(search?.kind).toBe('command_search');
        expect(search?.query).toBe('select all');
        expect(search?.rows[0]).toMatchObject({ label: 'Select All', path: 'Edit', enabled: true, active: true });
        await client.toolCallExpectOk('keyboard_input', { code: 'Enter' });
        expect(await openMenusRead()).toEqual([]);
        const allBrushIds = await sceneBrushIdsRead();
        const selection = await desktopE2eWaitUntil(
          'every brush to be selected',
          async () => {
            const read = await client.toolDataExpectOk<CommandsE2eSelection>('get_selection');
            return read.brushIds.length === allBrushIds.length ? read : null;
          },
          STEP_TIMEOUT_MILLISECONDS,
        );
        expect(new Set(selection.brushIds)).toEqual(new Set(allBrushIds));
      },
      STEP_TIMEOUT_MILLISECONDS * 2,
    );
  },
);
