import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve } from 'node:path';
import { e2eRequiredConfigurationAssert, e2eWindowsShownRead } from '../preview_e2e_environment.js';
import { DesktopE2eAppProcess } from './desktop_e2e_app_process.js';
import { DesktopE2eMcpClient } from './desktop_e2e_mcp_client.js';
import { desktopE2eWaitUntil } from './desktop_e2e_wait.js';

/**
 * End-to-end acceptance of dockable, resizable tool windows in the built
 * desktop app: the Entity Browser docks to the right of the map views and
 * squeezes them, two browsers docked to one edge share it, a floating browser
 * takes the position and size it is given, floating browsers tile without
 * overlapping, and a docked browser comes back docked after a restart. Skipped
 * unless BROOM_E2E_DESKTOP_EXE names the app launcher.
 */
const desktopExecutable = process.env['BROOM_E2E_DESKTOP_EXE'] ? resolve(process.env['BROOM_E2E_DESKTOP_EXE']) : '';
e2eRequiredConfigurationAssert(desktopExecutable !== '', ['BROOM_E2E_DESKTOP_EXE']);
const mcpBasePort = Number(process.env['BROOM_E2E_TOOL_WINDOW_DOCK_MCP_PORT'] ?? '19125');
const LAUNCH_TIMEOUT_MILLISECONDS = 90000;
const STEP_TIMEOUT_MILLISECONDS = 60000;

/** Screen rect of a get_shell_layout area. */
interface DockE2eBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Parts of a get_shell_layout reply the steps read. */
interface DockE2eShellLayout {
  views: DockE2eBounds;
  dockLeft: DockE2eBounds;
  dockRight: DockE2eBounds;
}

/** One tool window of a get_main_window reply. */
interface DockE2eToolWindow {
  placement: string;
  isOpen: boolean;
  rect: { left: number; top: number; width: number; height: number } | null;
}

/** Browser windows the steps move around. */
const DOCK_E2E_BROWSERS = ['entity_browser', 'level_browser', 'texture_browser'] as const;

/**
 * Returns whether a window rect lies inside an area, allowing one pixel of
 * rounding.
 *
 * @param rect Window rect.
 * @param area Area bounds.
 * @returns True inside.
 */
function dockE2eRectInside(rect: DockE2eToolWindow['rect'], area: DockE2eBounds): boolean {
  if (rect === null) return false;
  return (
    rect.left >= area.x - 1 &&
    rect.top >= area.y - 1 &&
    rect.left + rect.width <= area.x + area.width + 1 &&
    rect.top + rect.height <= area.y + area.height + 1
  );
}

describe.skipIf(desktopExecutable === '')('desktop dockable tool windows end to end', () => {
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
   * Reads every tool window.
   *
   * @returns Tool windows by layout id.
   */
  async function toolWindowsRead(): Promise<Record<string, DockE2eToolWindow>> {
    return (await client.toolDataExpectOk<{ toolWindows: Record<string, DockE2eToolWindow> }>('get_main_window'))
      .toolWindows;
  }

  /**
   * Reads one tool window, failing when the editor does not know it.
   *
   * @param windowId Layout id.
   * @returns Tool window.
   */
  async function toolWindowRead(windowId: string): Promise<DockE2eToolWindow> {
    const toolWindow = (await toolWindowsRead())[windowId];
    if (!toolWindow) throw new Error(`tool window ${windowId} unknown`);
    return toolWindow;
  }

  /**
   * Waits until the main window layout satisfies a check.
   *
   * @param description What the wait is for.
   * @param isReached Check on the layout.
   * @returns The layout.
   */
  async function shellLayoutWait(
    description: string,
    isReached: (layout: DockE2eShellLayout) => boolean,
  ): Promise<DockE2eShellLayout> {
    return desktopE2eWaitUntil(
      description,
      async () => {
        const layout = await client.toolDataExpectOk<DockE2eShellLayout>('get_shell_layout');
        return isReached(layout) ? layout : null;
      },
      STEP_TIMEOUT_MILLISECONDS,
    );
  }

  /**
   * Resets the window layout and closes every browser so the app keeps no
   * layout from the test.
   */
  async function browsersFloatAndClose(): Promise<void> {
    const closed = Object.fromEntries(DOCK_E2E_BROWSERS.map((windowId) => [windowId, false]));
    await client.toolCallExpectOk('set_main_window', { resetWindowLayout: true, floatingWindows: closed });
  }

  beforeAll(async () => {
    await appLaunch();
    await browsersFloatAndClose();
  }, LAUNCH_TIMEOUT_MILLISECONDS * 2);

  afterAll(async () => {
    await browsersFloatAndClose();
    await app.stop();
  }, LAUNCH_TIMEOUT_MILLISECONDS);

  it(
    'docks the Entity Browser right of the map views, which get narrower, and keeps its tiles working',
    async () => {
      const before = await client.toolDataExpectOk<DockE2eShellLayout>('get_shell_layout');
      await client.toolCallExpectOk('set_main_window', {
        floatingWindows: { entity_browser: true },
        toolWindowPlacements: { entity_browser: 'right' },
      });
      const docked = await shellLayoutWait('the right dock', (layout) => layout.dockRight.width > 0);
      expect(docked.views.width).toBeLessThan(before.views.width);
      const entityBrowser = await toolWindowRead('entity_browser');
      expect(entityBrowser.placement).toBe('right');
      expect(dockE2eRectInside(entityBrowser.rect, docked.dockRight)).toBe(true);
      const tiles = await client.toolDataExpectOk<{ tiles: unknown[] }>('get_entity_browser_tiles');
      expect(tiles.tiles.length).toBeGreaterThan(0);
    },
    STEP_TIMEOUT_MILLISECONDS,
  );

  it(
    'shares the left dock between two browsers and hides the right dock once it is empty',
    async () => {
      await client.toolCallExpectOk('set_main_window', {
        floatingWindows: { level_browser: true },
        toolWindowPlacements: { entity_browser: 'left', level_browser: 'left' },
      });
      const layout = await shellLayoutWait(
        'the left dock to replace the right one',
        (candidate) => candidate.dockLeft.width > 0 && candidate.dockRight.width === 0,
      );
      const windows = await toolWindowsRead();
      expect(windows['entity_browser']?.placement).toBe('left');
      expect(windows['level_browser']?.placement).toBe('left');
      const shownInDock = [windows['entity_browser'], windows['level_browser']].filter((toolWindow) =>
        dockE2eRectInside(toolWindow?.rect ?? null, layout.dockLeft),
      );
      expect(shownInDock.length).toBeGreaterThan(0);
    },
    STEP_TIMEOUT_MILLISECONDS,
  );

  it(
    'floats a browser at the position and size it is given and tiles floating browsers without overlap',
    async () => {
      const rect = { left: 120, top: 140, width: 420, height: 330 };
      await client.toolCallExpectOk('set_main_window', {
        toolWindowPlacements: { entity_browser: 'floating', level_browser: 'floating' },
        toolWindowRects: { entity_browser: rect },
      });
      const floating = await toolWindowRead('entity_browser');
      expect(floating.placement).toBe('floating');
      expect(floating.rect?.width).toBeCloseTo(rect.width, 0);
      expect(floating.rect?.height).toBeCloseTo(rect.height, 0);
      await client.toolCallExpectOk('set_main_window', { tileFloatingWindows: true });
      const windows = await toolWindowsRead();
      const first = windows['entity_browser']?.rect;
      const second = windows['level_browser']?.rect;
      if (!first || !second) throw new Error('tiled browsers are not open');
      const overlapsHorizontally = first.left < second.left + second.width && second.left < first.left + first.width;
      const overlapsVertically = first.top < second.top + second.height && second.top < first.top + first.height;
      expect(overlapsHorizontally && overlapsVertically).toBe(false);
    },
    STEP_TIMEOUT_MILLISECONDS,
  );

  it(
    'opens a browser docked at quit docked again after a restart',
    async () => {
      await client.toolCallExpectOk('set_main_window', {
        floatingWindows: { level_browser: false, entity_browser: true },
        toolWindowPlacements: { entity_browser: 'bottom' },
      });
      await desktopE2eWaitUntil(
        'the docked browser to be saved',
        async () => ((await toolWindowRead('entity_browser')).placement === 'bottom' ? true : null),
        STEP_TIMEOUT_MILLISECONDS,
      );
      await app.stop();
      await appLaunch();
      const reopened = await desktopE2eWaitUntil(
        'the Entity Browser to reopen docked',
        async () => {
          const toolWindow = await toolWindowRead('entity_browser');
          return toolWindow.isOpen ? toolWindow : null;
        },
        STEP_TIMEOUT_MILLISECONDS,
      );
      expect(reopened.placement).toBe('bottom');
    },
    LAUNCH_TIMEOUT_MILLISECONDS * 2,
  );
});
