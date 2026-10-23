import { afterEach, describe, expect, it } from 'vitest';
import { Toolbar } from '@/ui/toolbar/toolbar.js';
import { shellMenuBarPopulate, shellMenusBuiltinCreate } from '@/layout/shell/menubar/shell_menu_bar.js';
import type { ShellMenu, ShellMenuContext } from '@/layout/shell/menubar/shell_menu.js';
import { isMenuSubmenu, type ToolbarMenuEntry } from '@/ui/menu/menu_types.js';
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
} from '../shell_test_support.js';
import { workbenchRigCreate } from '../../../project/workbench/project_workbench_rig.js';

/** Docks, actions and context shared by one menu bar test. */
interface ShellMenuBarTestRig {
  readonly docks: ShellTestDocks;
  readonly toolbarActions: ShellTestToolbarActions;
  readonly windowActions: ShellTestWindowActions;
  readonly context: ShellMenuContext;
}

/** Rig built by the running test. */
let shellMenuBarTestRig: ShellMenuBarTestRig | null = null;

/**
 * Builds docks, spy actions and a menu context for one test.
 *
 * @param toolbarActions Toolbar actions the menus run.
 * @returns Test rig remembered for cleanup.
 */
function shellMenuBarTestRigCreate(
  toolbarActions: ShellTestToolbarActions = shellTestToolbarActionsCreate(),
): ShellMenuBarTestRig {
  const docks = shellTestDocksCreate();
  const windowActions = new ShellTestWindowActions();
  const context = shellTestMenuContextCreate(docks, toolbarActions, windowActions);
  shellMenuBarTestRig = { docks, toolbarActions, windowActions, context };
  return shellMenuBarTestRig;
}

/**
 * Builds the entries of the built-in menu with a label.
 *
 * @param context Menu context.
 * @param label Menu label.
 * @returns Menu entries.
 */
function shellMenuBarTestEntriesBuild(context: ShellMenuContext, label: string): ToolbarMenuEntry[] {
  const menu = shellMenusBuiltinCreate().find((candidate: ShellMenu) => candidate.label === label);
  if (!menu) {
    throw new Error(`Menu ${label} not found`);
  }
  return menu.entriesBuild(context);
}

/**
 * Finds the open root dropdown panel mounted on the document body.
 *
 * @returns Open menu panel element.
 */
function shellMenuBarTestOpenPanelRead(): HTMLElement {
  const panel = document.body.querySelector<HTMLElement>('.editor-toolbar-dropdown-menu[style*="display: block"]');
  if (!panel) {
    throw new Error('No open menu panel');
  }
  return panel;
}

/**
 * Finds the row button in an open panel whose text starts with a label.
 *
 * @param panel Open menu panel.
 * @param label Row label.
 * @returns Row button.
 */
function shellMenuBarTestRowRead(panel: HTMLElement, label: string): HTMLButtonElement {
  const row = [...panel.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
    (button.textContent ?? '').trim().startsWith(label),
  );
  if (!row) {
    throw new Error(`Menu row ${label} not found`);
  }
  return row;
}

afterEach(() => {
  if (shellMenuBarTestRig) {
    shellTestDocksDispose(shellMenuBarTestRig.docks);
    shellMenuBarTestRig = null;
  }
  document.body.replaceChildren();
});

describe('shellMenusBuiltinCreate', () => {
  it('creates the main window menus in menu bar order', () => {
    expect(shellMenusBuiltinCreate().map((menu) => menu.label)).toEqual([
      'File',
      'Edit',
      'Add',
      'Tools',
      'View',
      'Run',
      'Help',
    ]);
  });

  it('gives every menu at least one entry', () => {
    const { context } = shellMenuBarTestRigCreate();
    shellMenusBuiltinCreate().forEach((menu) => {
      expect(menu.entriesBuild(context).length).toBeGreaterThan(0);
    });
  });
});

describe('shellMenuBarPopulate', () => {
  it('adds one header per menu in order to a menu bar without a resize handle', () => {
    const { docks, context } = shellMenuBarTestRigCreate();
    const menuBar = new Toolbar(docks.frame.menuBarHostRead(), 'menubar');
    const menus = shellMenusBuiltinCreate();
    shellMenuBarPopulate(menuBar, menus, context);
    const headers = [...menuBar.getElement().querySelectorAll<HTMLButtonElement>('.editor-toolbar-menu-button')];
    expect(headers.map((header) => (header.textContent ?? '').trim())).toEqual(menus.map((menu) => menu.label));
    expect(menuBar.getElement().querySelector('.editor-toolbar-resize-handle')).toBeNull();
    menuBar.dispose();
  });

  it('runs the action of a row clicked in an opened menu and shows its shortcut label', () => {
    const { docks, context, toolbarActions } = shellMenuBarTestRigCreate();
    const menuBar = new Toolbar(docks.frame.menuBarHostRead(), 'menubar');
    shellMenuBarPopulate(menuBar, shellMenusBuiltinCreate(), context);
    const editIndex = menuBar.getButtonIndexByLabel('Edit');
    const editHeader = menuBar.getElement().querySelectorAll<HTMLButtonElement>('.editor-toolbar-menu-button')[
      editIndex
    ];
    editHeader?.click();
    const undoRow = shellMenuBarTestRowRead(shellMenuBarTestOpenPanelRead(), 'Undo');
    expect(undoRow.textContent).toContain(shellTestShortcutLabelFormat('undo'));
    undoRow.click();
    expect(toolbarActions.onUndo).toHaveBeenCalledTimes(1);
    menuBar.dispose();
  });
});

describe('ShellMenuFile', () => {
  it('offers Save As right after Save with its own action and shortcut label', () => {
    const { context, toolbarActions, windowActions } = shellMenuBarTestRigCreate();
    const entries = shellMenuBarTestEntriesBuild(context, 'File');
    const labels = shellTestMenuLabelsRead(entries);
    expect(labels.indexOf('Save As…')).toBe(labels.indexOf('Save') + 1);
    const saveAs = shellTestMenuActionFind(entries, 'Save As…');
    saveAs.onClick();
    expect(toolbarActions.onSaveSceneAs).toHaveBeenCalledTimes(1);
    expect(shellTestMenuShortcutRead(saveAs)).toBe(shellTestShortcutLabelFormat('save_as'));
    expect(windowActions.shortcutLabelRead).toHaveBeenCalledWith('save_as');
  });

  it('runs import and export rows from their submenus', () => {
    const { context, toolbarActions } = shellMenuBarTestRigCreate();
    const entries = shellMenuBarTestEntriesBuild(context, 'File');
    shellTestMenuActionFind(entries, 'Import', 'Valve Map Format 2006 (.vmf)…').onClick();
    shellTestMenuActionFind(entries, 'Export', 'Export GLTF (.glb)…').onClick();
    expect(toolbarActions.onImportVmf).toHaveBeenCalledTimes(1);
    expect(toolbarActions.onExportGlb).toHaveBeenCalledTimes(1);
  });
});

describe('ShellMenuEdit', () => {
  it('routes history actions to the toolbar actions and selection actions to the window actions', () => {
    const { context, toolbarActions, windowActions } = shellMenuBarTestRigCreate();
    const entries = shellMenuBarTestEntriesBuild(context, 'Edit');
    shellTestMenuActionFind(entries, 'Redo').onClick();
    shellTestMenuActionFind(entries, 'Select All').onClick();
    shellTestMenuActionFind(entries, 'Select None').onClick();
    expect(toolbarActions.onRedo).toHaveBeenCalledTimes(1);
    expect(windowActions.selectAll).toHaveBeenCalledTimes(1);
    expect(windowActions.selectNone).toHaveBeenCalledTimes(1);
    expect(shellTestMenuShortcutRead(shellTestMenuActionFind(entries, 'Select All'))).toBe(
      shellTestShortcutLabelFormat('select_all'),
    );
  });

  it('enables the CSG rows only while the selection supports booleans', () => {
    let canRunCsg = false;
    const { context, toolbarActions } = shellMenuBarTestRigCreate(
      shellTestToolbarActionsCreate({ canRunCsgBoolean: () => canRunCsg }),
    );
    const union = shellTestMenuActionFind(shellMenuBarTestEntriesBuild(context, 'Edit'), 'CSG', 'Union');
    expect(union.isEnabled?.()).toBe(false);
    canRunCsg = true;
    expect(union.isEnabled?.()).toBe(true);
    union.onClick();
    expect(toolbarActions.onCsgUnion).toHaveBeenCalledTimes(1);
  });
});

describe('ShellMenuAdd', () => {
  it('lists the add sections as submenus whose rows create objects', () => {
    const { context, toolbarActions } = shellMenuBarTestRigCreate();
    const entries = shellMenuBarTestEntriesBuild(context, 'Add');
    expect(entries.every((entry) => isMenuSubmenu(entry))).toBe(true);
    shellTestMenuActionFind(entries, 'Geometry', 'Cube').onClick();
    expect(toolbarActions.onAddCube).toHaveBeenCalledTimes(1);
  });
});

describe('ShellMenuRun', () => {
  it('starts play mode and opens the game preview', () => {
    const { context, toolbarActions, windowActions } = shellMenuBarTestRigCreate();
    const entries = shellMenuBarTestEntriesBuild(context, 'Run');
    const play = shellTestMenuActionFind(entries, 'Play');
    play.onClick();
    shellTestMenuActionFind(entries, 'Game Preview…').onClick();
    expect(windowActions.playStart).toHaveBeenCalledTimes(1);
    expect(toolbarActions.onToggleGamePreviewPanel).toHaveBeenCalledTimes(1);
    expect(shellTestMenuShortcutRead(play)).toBe(shellTestShortcutLabelFormat('play_start'));
  });

  it('offers game actions only for an open project and runs them through the workbench', async () => {
    const rig = workbenchRigCreate();
    const toolbarActions = shellTestToolbarActionsCreate({ gameProjectWorkbenchRead: () => rig.workbench });
    const { context } = shellMenuBarTestRigCreate(toolbarActions);
    const entries = shellMenuBarTestEntriesBuild(context, 'Run');
    const launch = shellTestMenuActionFind(entries, 'Launch Game');
    expect(launch.isEnabled?.()).toBe(false);
    await rig.workbench.projectOpen('/games/menu game/broom.project.json');
    expect(launch.isEnabled?.()).toBe(true);
    expect(shellTestMenuActionFind(entries, 'Stop Game').isEnabled?.()).toBe(false);
    launch.onClick();
    await Promise.resolve();
    expect(rig.control.actions).toEqual(['launch']);
    rig.workbench.dispose();
  });
});

describe('ShellMenuFile projects', () => {
  it('opens a project and lists it under Recent Projects', async () => {
    const rig = workbenchRigCreate();
    rig.control.chosenFile = '/games/recent game/broom.project.json';
    const toolbarActions = shellTestToolbarActionsCreate({ gameProjectWorkbenchRead: () => rig.workbench });
    const { context } = shellMenuBarTestRigCreate(toolbarActions);
    const entries = shellMenuBarTestEntriesBuild(context, 'File');
    const recent = entries.find((entry) => isMenuSubmenu(entry) && entry.label === 'Recent Projects');
    if (!recent || !isMenuSubmenu(recent)) {
      throw new Error('Recent Projects submenu missing');
    }
    expect(recent.isEnabled?.()).toBe(false);
    shellTestMenuActionFind(entries, 'Open Project…').onClick();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(recent.isEnabled?.()).toBe(true);
    expect(shellTestMenuLabelsRead(recent.childrenResolve?.() ?? [])).toEqual([
      '/games/recent game/broom.project.json',
    ]);
    rig.workbench.dispose();
  });
});

describe('ShellMenuHelp', () => {
  it('checks Editor Sounds while audio is enabled and toggles it on click', () => {
    let audioEnabled = true;
    const { context, toolbarActions } = shellMenuBarTestRigCreate(
      shellTestToolbarActionsCreate({ isAudioEnabled: () => audioEnabled }),
    );
    const sounds = shellTestMenuActionFind(shellMenuBarTestEntriesBuild(context, 'Help'), 'Editor Sounds');
    expect(sounds.isChecked?.()).toBe(true);
    audioEnabled = false;
    expect(sounds.isChecked?.()).toBe(false);
    sounds.onClick();
    expect(toolbarActions.onToggleAudio).toHaveBeenCalledTimes(1);
  });

  it('opens the MCP server dialog and the AI capture panel', () => {
    const { context, toolbarActions } = shellMenuBarTestRigCreate();
    const entries = shellMenuBarTestEntriesBuild(context, 'Help');
    shellTestMenuActionFind(entries, 'MCP Server…').onClick();
    shellTestMenuActionFind(entries, 'AI Captures (Debug)…').onClick();
    expect(toolbarActions.onOpenMcpDialog).toHaveBeenCalledTimes(1);
    expect(toolbarActions.onToggleAiCaptureDebugPanel).toHaveBeenCalledTimes(1);
  });
});
