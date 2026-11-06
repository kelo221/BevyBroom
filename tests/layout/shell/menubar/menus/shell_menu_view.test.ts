import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HandlerSelectionVisibility } from '@/selection/visibility/handler_selection_visibility.js';
import { ShellMenuView } from '@/layout/shell/menubar/menus/shell_menu_view.js';
import type { ShellMenuContext } from '@/layout/shell/menubar/shell_menu.js';
import type { ShellFloatingWindowId } from '@/layout/shell/actions/shell_floating_window.js';
import type { KeyboardShortcutAction } from '@/settings/store/settings_types.js';
import { SNAP_PRESETS } from '@/types/snap_presets.js';
import { formatGridIntervalLabel } from '@/layout/shell/toolbar/shell_grid_interval_label.js';
import { isMenuAction, type ToolbarMenuEntry } from '@/ui/menu/menu_types.js';
import {
  ShellTestWindowActions,
  shellTestDocksCreate,
  shellTestDocksDispose,
  shellTestMenuActionFind,
  shellTestMenuContextCreate,
  shellTestMenuLabelsRead,
  shellTestMenuShortcutRead,
  shellTestMenuSubmenuChildrenRead,
  shellTestShortcutLabelFormat,
  shellTestToolbarActionsCreate,
  type ShellTestDocks,
  type ShellTestToolbarActions,
} from '../../shell_test_support.js';

/** Floating window rows of the View menu with the window they open. */
const SHELL_MENU_VIEW_TEST_FLOATING_ROWS: ReadonlyArray<readonly [string, ShellFloatingWindowId]> = [
  ['Texture Browser', 'texture_browser'],
  ['Entity Browser', 'entity_browser'],
];

/**
 * View menu rows that run one window action, with the shortcut action they
 * show.
 */
const SHELL_MENU_VIEW_TEST_WINDOW_ROWS: ReadonlyArray<
  readonly [string, 'frameSelection' | 'frameAll' | 'viewCycle' | 'viewMaximize', KeyboardShortcutAction]
> = [
  ['Frame Selection', 'frameSelection', 'fit_selection'],
  ['Frame Selection in All Views', 'frameAll', 'fit_all'],
  ['Cycle View', 'viewCycle', 'view_cycle'],
  ['Maximize View', 'viewMaximize', 'view_maximize'],
];

/**
 * View menu visibility rows with the command they run, the shortcut action they
 * show and whether they need a selection.
 */
const SHELL_MENU_VIEW_TEST_VISIBILITY_ROWS: ReadonlyArray<
  readonly [string, 'hideSelected' | 'isolateSelected' | 'showAll', KeyboardShortcutAction, boolean]
> = [
  ['Hide Selected', 'hideSelected', 'visibility_hide', true],
  ['Isolate Selected', 'isolateSelected', 'visibility_isolate', true],
  ['Show All', 'showAll', 'visibility_show_all', false],
];

/**
 * Creates visibility commands whose every command is a spy.
 *
 * @returns Spy visibility commands.
 */
function shellMenuViewTestVisibilitySpyCreate(): HandlerSelectionVisibility {
  const spies = { hideSelected: vi.fn(() => 0), isolateSelected: vi.fn(() => 0), showAll: vi.fn(() => 0) };
  return spies as unknown as HandlerSelectionVisibility;
}

/** Docks, actions and View menu entries shared by one test. */
interface ShellMenuViewTestRig {
  readonly docks: ShellTestDocks;
  readonly toolbarActions: ShellTestToolbarActions;
  readonly windowActions: ShellTestWindowActions;
  readonly context: ShellMenuContext;
  readonly entries: ToolbarMenuEntry[];
}

/** Rig built by the running test. */
let shellMenuViewTestRig: ShellMenuViewTestRig | null = null;

/**
 * Builds docks, spy actions and the View menu entries for one test.
 *
 * @returns Test rig remembered for cleanup.
 */
function shellMenuViewTestRigCreate(): ShellMenuViewTestRig {
  const docks = shellTestDocksCreate();
  const toolbarActions = shellTestToolbarActionsCreate();
  const windowActions = new ShellTestWindowActions();
  const context = shellTestMenuContextCreate(docks, toolbarActions, windowActions);
  const entries = new ShellMenuView().entriesBuild(context);
  shellMenuViewTestRig = { docks, toolbarActions, windowActions, context, entries };
  return shellMenuViewTestRig;
}

/**
 * Returns the labels of the checked rows among some entries.
 *
 * @param entries Menu entries.
 * @returns Labels of action rows whose isChecked returns true.
 */
function shellMenuViewTestCheckedLabelsRead(entries: readonly ToolbarMenuEntry[]): string[] {
  return entries.flatMap((entry) => (isMenuAction(entry) && entry.isChecked?.() === true ? [entry.label] : []));
}

afterEach(() => {
  if (shellMenuViewTestRig) {
    shellTestDocksDispose(shellMenuViewTestRig.docks);
    shellMenuViewTestRig = null;
  }
  document.body.replaceChildren();
});

describe('ShellMenuView', () => {
  it('is labelled View', () => {
    expect(new ShellMenuView().label).toBe('View');
  });

  it('lists every grid preset in the Grid submenu after the grid size steps', () => {
    const { entries } = shellMenuViewTestRigCreate();
    const gridChildren = shellTestMenuSubmenuChildrenRead(entries, 'Grid');
    const presetLabels = gridChildren.flatMap((entry) =>
      isMenuAction(entry) && entry.label.startsWith('Grid ') ? [entry.label] : [],
    );
    expect(presetLabels).toEqual(SNAP_PRESETS.map((interval) => formatGridIntervalLabel(interval)));
  });

  it('checks only the preset that matches the current grid size', () => {
    const { entries, windowActions } = shellMenuViewTestRigCreate();
    const gridChildren = shellTestMenuSubmenuChildrenRead(entries, 'Grid');
    SNAP_PRESETS.forEach((interval) => {
      windowActions.gridIntervalChange(interval);
      expect(shellMenuViewTestCheckedLabelsRead(gridChildren)).toEqual([formatGridIntervalLabel(interval)]);
    });
  });

  it('sets the grid size when a preset row is clicked', () => {
    const { entries, windowActions } = shellMenuViewTestRigCreate();
    const lastPreset = SNAP_PRESETS[SNAP_PRESETS.length - 1] ?? 1;
    shellTestMenuActionFind(entries, 'Grid', formatGridIntervalLabel(lastPreset)).onClick();
    expect(windowActions.gridIntervalSet).toHaveBeenCalledWith(lastPreset);
    expect(windowActions.gridIntervalRead()).toBe(lastPreset);
  });

  it('steps the grid size through the toolbar actions with their shortcut labels', () => {
    const { entries, toolbarActions } = shellMenuViewTestRigCreate();
    const increase = shellTestMenuActionFind(entries, 'Grid', 'Increase Grid Size');
    const decrease = shellTestMenuActionFind(entries, 'Grid', 'Decrease Grid Size');
    increase.onClick();
    decrease.onClick();
    expect(toolbarActions.onSnapIntervalForward).toHaveBeenCalledTimes(1);
    expect(toolbarActions.onSnapIntervalBackward).toHaveBeenCalledTimes(1);
    expect(shellTestMenuShortcutRead(increase)).toBe(shellTestShortcutLabelFormat('snap_forward'));
    expect(shellTestMenuShortcutRead(decrease)).toBe(shellTestShortcutLabelFormat('snap_backward'));
  });

  SHELL_MENU_VIEW_TEST_WINDOW_ROWS.forEach(([label, member, shortcutAction]) => {
    it(`runs ${label} through the window actions`, () => {
      const { entries, windowActions } = shellMenuViewTestRigCreate();
      const row = shellTestMenuActionFind(entries, label);
      row.onClick();
      expect(windowActions[member]).toHaveBeenCalledTimes(1);
      expect(shellTestMenuShortcutRead(row)).toBe(shellTestShortcutLabelFormat(shortcutAction));
    });
  });

  SHELL_MENU_VIEW_TEST_VISIBILITY_ROWS.forEach(([label, member, shortcutAction, needsSelection]) => {
    it(`runs ${label} through the visibility commands and enables it by selection`, () => {
      const { entries, windowActions } = shellMenuViewTestRigCreate();
      const visibility = shellMenuViewTestVisibilitySpyCreate();
      windowActions.selectionVisibility = visibility;
      const row = shellTestMenuActionFind(entries, label);
      windowActions.clipboardSelectionHasObjects = false;
      expect(row.isEnabled?.() ?? true).toBe(!needsSelection);
      windowActions.clipboardSelectionHasObjects = true;
      expect(row.isEnabled?.() ?? true).toBe(true);
      row.onClick();
      expect(visibility[member]).toHaveBeenCalledTimes(1);
      expect(shellTestMenuShortcutRead(row)).toBe(shellTestShortcutLabelFormat(shortcutAction));
    });
  });

  it('reveals the inspector from Map Inspector and checks it while shown', () => {
    const { entries, docks } = shellMenuViewTestRigCreate();
    const row = shellTestMenuActionFind(entries, 'Map Inspector');
    docks.frame.inspectorVisibleSet(false);
    expect(row.isChecked?.()).toBe(false);
    row.onClick();
    expect(docks.frame.isInspectorVisible()).toBe(true);
    expect(row.isChecked?.()).toBe(true);
    expect(shellTestMenuShortcutRead(row)).toBe(shellTestShortcutLabelFormat('inspector_map'));
  });

  it('lists no Entity or Face inspector rows', () => {
    const { entries } = shellMenuViewTestRigCreate();
    const labels = shellTestMenuLabelsRead(entries);
    expect(labels).not.toContain('Entity Inspector');
    expect(labels).not.toContain('Face Inspector');
  });

  SHELL_MENU_VIEW_TEST_FLOATING_ROWS.forEach(([label, windowId]) => {
    it(`toggles the ${windowId} floating window from ${label} and checks it while open`, () => {
      const { entries, docks } = shellMenuViewTestRigCreate();
      let isOpen = false;
      docks.dockCommands.floatingWindowRegister(windowId, {
        toggle: () => {
          isOpen = !isOpen;
        },
        isOpen: () => isOpen,
      });
      const row = shellTestMenuActionFind(entries, label);
      expect(row.isChecked?.()).toBe(false);
      row.onClick();
      expect(isOpen).toBe(true);
      expect(row.isChecked?.()).toBe(true);
      row.onClick();
      expect(row.isChecked?.()).toBe(false);
    });
  });

  it('toggles the docks and the toolbar and checks the rows while they are shown', () => {
    const { entries, docks } = shellMenuViewTestRigCreate();
    const rows: ReadonlyArray<readonly [string, () => boolean]> = [
      ['Show Inspector', () => docks.frame.isInspectorVisible()],
      ['Show Info Panel', () => docks.frame.isInfoPanelVisible()],
      ['Show Toolbar', () => docks.frame.isToolbarVisible()],
    ];
    rows.forEach(([label, isVisible]) => {
      const row = shellTestMenuActionFind(entries, label);
      expect(row.isChecked?.()).toBe(isVisible());
      row.onClick();
      expect(row.isChecked?.()).toBe(isVisible());
      expect(isVisible()).toBe(false);
    });
  });

  it('collapses and expands the info panel from Collapse Info Panel and checks it while collapsed', () => {
    const { entries, docks } = shellMenuViewTestRigCreate();
    const row = shellTestMenuActionFind(entries, 'Collapse Info Panel');
    const collapsedBefore = docks.frame.isInfoPanelCollapsed();
    expect(row.isChecked?.()).toBe(collapsedBefore);
    row.onClick();
    expect(docks.frame.isInfoPanelCollapsed()).toBe(!collapsedBefore);
    expect(row.isChecked?.()).toBe(!collapsedBefore);
    row.onClick();
    expect(docks.frame.isInfoPanelCollapsed()).toBe(collapsedBefore);
    expect(shellTestMenuShortcutRead(row)).toBe(shellTestShortcutLabelFormat('info_panel_collapse_toggle'));
  });

  it('opens a detached viewport', () => {
    const { entries, toolbarActions } = shellMenuViewTestRigCreate();
    shellTestMenuActionFind(entries, 'Detached Viewport…').onClick();
    expect(toolbarActions.onOpenDetachedViewport).toHaveBeenCalledTimes(1);
  });
});
