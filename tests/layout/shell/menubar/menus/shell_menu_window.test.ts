import { afterEach, describe, expect, it } from 'vitest';
import {
  SHELL_MENU_WINDOW_BROWSERS,
  SHELL_MENU_WINDOW_RESET_LABEL,
  SHELL_MENU_WINDOW_TILE_LABEL,
  ShellMenuWindow,
} from '@/layout/shell/menubar/menus/shell_menu_window.js';
import { PanelFloatingContentHost } from '@/ui/floating_panel/panel_floating_content_host.js';
import type { ShellMenuContext } from '@/layout/shell/menubar/shell_menu.js';
import type { ToolbarMenuEntry } from '@/ui/menu/menu_types.js';
import {
  ShellTestWindowActions,
  shellTestDocksCreate,
  shellTestDocksDispose,
  shellTestMenuActionFind,
  shellTestMenuContextCreate,
  shellTestMenuLabelsRead,
  shellTestMenuShortcutRead,
  shellTestShortcutLabelFormat,
  shellTestToolbarActionsCreate,
  type ShellTestDocks,
  type ShellTestToolbarActions,
} from '../../shell_test_support.js';

/** Docks, actions and Window menu entries built for one test. */
interface ShellMenuWindowTestRig {
  readonly docks: ShellTestDocks;
  readonly toolbarActions: ShellTestToolbarActions;
  readonly context: ShellMenuContext;
  readonly entries: ToolbarMenuEntry[];
}

/** Rig built by the running test. */
let shellMenuWindowTestRig: ShellMenuWindowTestRig | null = null;

/**
 * Builds docks, spy actions and the Window menu entries for one test.
 *
 * @returns Test rig remembered for cleanup.
 */
function shellMenuWindowTestRigCreate(): ShellMenuWindowTestRig {
  const docks = shellTestDocksCreate();
  const toolbarActions = shellTestToolbarActionsCreate();
  const context = shellTestMenuContextCreate(docks, toolbarActions, new ShellTestWindowActions());
  const entries = new ShellMenuWindow().entriesBuild(context);
  shellMenuWindowTestRig = { docks, toolbarActions, context, entries };
  return shellMenuWindowTestRig;
}

afterEach(() => {
  if (shellMenuWindowTestRig) {
    shellTestDocksDispose(shellMenuWindowTestRig.docks);
    shellMenuWindowTestRig = null;
  }
  document.body.replaceChildren();
});

/**
 * The Window menu gathers every window and panel: the browsers with their
 * shortcuts, the Map inspector, the Solid Model panel, the detached viewport,
 * the AI capture debug panel and the window layout commands.
 */
describe('ShellMenuWindow', () => {
  it('is labelled Window and lists the browsers first, in their own section', () => {
    const { entries } = shellMenuWindowTestRigCreate();
    expect(new ShellMenuWindow().label).toBe('Window');
    const browserLabels = SHELL_MENU_WINDOW_BROWSERS.map((browser) => browser.label);
    expect(shellTestMenuLabelsRead(entries).slice(0, browserLabels.length)).toEqual(browserLabels);
    expect(entries[browserLabels.length]).toEqual(expect.objectContaining({ kind: 'separator' }));
  });

  SHELL_MENU_WINDOW_BROWSERS.forEach((browser) => {
    it(`toggles the ${browser.windowId} window from ${browser.label}, checks it while open and shows its shortcut`, () => {
      const { entries, docks } = shellMenuWindowTestRigCreate();
      let isOpen = false;
      docks.dockCommands.floatingWindowRegister(browser.windowId, {
        toggle: () => {
          isOpen = !isOpen;
        },
        isOpen: () => isOpen,
      });
      const row = shellTestMenuActionFind(entries, browser.label);
      expect(row.isChecked?.()).toBe(false);
      row.onClick();
      expect(row.isChecked?.()).toBe(true);
      row.onClick();
      expect(row.isChecked?.()).toBe(false);
      expect(shellTestMenuShortcutRead(row)).toBe(shellTestShortcutLabelFormat(browser.shortcutAction));
    });
  });

  it('reveals the inspector from Map Inspector and checks it while shown', () => {
    const { entries, docks } = shellMenuWindowTestRigCreate();
    const row = shellTestMenuActionFind(entries, 'Map Inspector');
    docks.frame.inspectorVisibleSet(false);
    expect(row.isChecked?.()).toBe(false);
    row.onClick();
    expect(docks.frame.isInspectorVisible()).toBe(true);
    expect(row.isChecked?.()).toBe(true);
    expect(shellTestMenuShortcutRead(row)).toBe(shellTestShortcutLabelFormat('inspector_map'));
  });

  it('opens the Solid Model panel, a detached viewport and the AI capture panel', () => {
    const { entries, toolbarActions } = shellMenuWindowTestRigCreate();
    shellTestMenuActionFind(entries, 'Solid Model…').onClick();
    shellTestMenuActionFind(entries, 'Detached Viewport…').onClick();
    shellTestMenuActionFind(entries, 'AI Captures (Debug)…').onClick();
    expect(toolbarActions.onToggleSolidModelPanel).toHaveBeenCalledTimes(1);
    expect(toolbarActions.onOpenDetachedViewport).toHaveBeenCalledTimes(1);
    expect(toolbarActions.onToggleAiCaptureDebugPanel).toHaveBeenCalledTimes(1);
  });

  it('tiles the open floating tool windows and resets the window layout', () => {
    const { entries } = shellMenuWindowTestRigCreate();
    const toolWindow = new PanelFloatingContentHost(
      document.body,
      { titleText: 'Menu Tool', className: 'menu-tool', width: '240px', height: '200px', layoutId: 'menu_tool' },
      document.createElement('div'),
    );
    toolWindow.show();
    shellTestMenuActionFind(entries, SHELL_MENU_WINDOW_TILE_LABEL).onClick();
    expect(toolWindow.getRootElement().style.width).toMatch(/px$/);
    shellMenuWindowTestRig?.docks.dockCommands.toolWindowDock('menu_tool', 'left');
    expect(toolWindow.isDocked()).toBe(true);
    shellTestMenuActionFind(entries, SHELL_MENU_WINDOW_RESET_LABEL).onClick();
    expect(toolWindow.isDocked()).toBe(false);
    expect(toolWindow.isOpen()).toBe(true);
    toolWindow.dispose();
  });
});
