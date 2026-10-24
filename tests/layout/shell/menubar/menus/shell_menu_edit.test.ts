import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShellMenuEdit } from '@/layout/shell/menubar/menus/shell_menu_edit.js';
import { selectionQueriesList } from '@/selection/query/selection_query_registry.js';
import type { ToolbarMenuEntry } from '@/ui/menu/menu_types.js';
import type { HandlerSolidBrushTools } from '@/tools/csg/solid/handler_solid_brush_tools.js';
import {
  ShellTestWindowActions,
  shellTestDocksCreate,
  shellTestDocksDispose,
  shellTestMenuActionFind,
  shellTestMenuContextCreate,
  shellTestMenuLabelsRead,
  shellTestMenuShortcutRead,
  shellTestShortcutLabelFormat,
  type ShellTestDocks,
} from '../../shell_test_support.js';

/** Docks, window actions and Edit menu entries shared by one test. */
interface ShellMenuEditTestRig {
  readonly docks: ShellTestDocks;
  readonly windowActions: ShellTestWindowActions;
  readonly entries: ToolbarMenuEntry[];
}

/** Rig built by the running test. */
let shellMenuEditTestRig: ShellMenuEditTestRig | null = null;

/**
 * Builds docks, test window actions and the Edit menu entries for one test.
 *
 * @returns Test rig remembered for cleanup.
 */
function shellMenuEditTestRigCreate(): ShellMenuEditTestRig {
  const docks = shellTestDocksCreate();
  const windowActions = new ShellTestWindowActions();
  const context = shellTestMenuContextCreate(docks, undefined, windowActions);
  shellMenuEditTestRig = { docks, windowActions, entries: new ShellMenuEdit().entriesBuild(context) };
  return shellMenuEditTestRig;
}

afterEach(() => {
  if (shellMenuEditTestRig) {
    shellTestDocksDispose(shellMenuEditTestRig.docks);
    shellMenuEditTestRig = null;
  }
  document.body.replaceChildren();
});

/** Clipboard rows of the Edit menu. */
describe('ShellMenuEdit clipboard entries', () => {
  it('lists Cut, Copy, Paste and Paste at Original Position right before Duplicate', () => {
    const labels = shellTestMenuLabelsRead(shellMenuEditTestRigCreate().entries);
    const duplicateIndex = labels.indexOf('Duplicate');
    expect(labels.slice(duplicateIndex - 4, duplicateIndex)).toEqual([
      'Cut',
      'Copy',
      'Paste',
      'Paste at Original Position',
    ]);
  });

  it('shows the fixed clipboard keys and the configured paste at original position key', () => {
    const { entries } = shellMenuEditTestRigCreate();
    expect(shellTestMenuShortcutRead(shellTestMenuActionFind(entries, 'Cut'))).toBe('Ctrl+X');
    expect(shellTestMenuShortcutRead(shellTestMenuActionFind(entries, 'Copy'))).toBe('Ctrl+C');
    expect(shellTestMenuShortcutRead(shellTestMenuActionFind(entries, 'Paste'))).toBe('Ctrl+V');
    expect(shellTestMenuShortcutRead(shellTestMenuActionFind(entries, 'Paste at Original Position'))).toBe(
      shellTestShortcutLabelFormat('paste_original'),
    );
  });

  it('enables Cut and Copy only while objects are selected and keeps Paste enabled', () => {
    const { entries, windowActions } = shellMenuEditTestRigCreate();
    const cut = shellTestMenuActionFind(entries, 'Cut');
    const copy = shellTestMenuActionFind(entries, 'Copy');
    const paste = shellTestMenuActionFind(entries, 'Paste');
    expect(cut.isEnabled?.()).toBe(false);
    expect(copy.isEnabled?.()).toBe(false);
    expect(paste.isEnabled?.() ?? true).toBe(true);
    windowActions.clipboardSelectionHasObjects = true;
    expect(cut.isEnabled?.()).toBe(true);
    expect(copy.isEnabled?.()).toBe(true);
  });

  it('runs the clipboard window actions', () => {
    const { entries, windowActions } = shellMenuEditTestRigCreate();
    shellTestMenuActionFind(entries, 'Cut').onClick();
    shellTestMenuActionFind(entries, 'Copy').onClick();
    shellTestMenuActionFind(entries, 'Paste').onClick();
    shellTestMenuActionFind(entries, 'Paste at Original Position').onClick();
    expect(windowActions.clipboardCut).toHaveBeenCalledOnce();
    expect(windowActions.clipboardCopy).toHaveBeenCalledOnce();
    expect(windowActions.clipboardPaste).toHaveBeenCalledOnce();
    expect(windowActions.clipboardPasteAtOriginalPosition).toHaveBeenCalledOnce();
  });
});

/**
 * Builds brush tools whose every command is a spy.
 *
 * @returns Spy brush tools.
 */
function brushToolsSpyCreate(): HandlerSolidBrushTools {
  return {
    hollow: vi.fn(() => null),
    convexMerge: vi.fn(() => null),
    flip: vi.fn(() => null),
    snapVertices: vi.fn(() => 0),
  } as unknown as HandlerSolidBrushTools;
}

/** Brush editing rows of the Edit menu. */
describe('ShellMenuEdit brush entries', () => {
  it('runs hollow and convex merge from the CSG submenu', () => {
    const { entries, windowActions } = shellMenuEditTestRigCreate();
    const brushTools = brushToolsSpyCreate();
    windowActions.solidBrushTools = brushTools;
    shellTestMenuActionFind(entries, 'CSG', 'Hollow').onClick();
    shellTestMenuActionFind(entries, 'CSG', 'Convex Merge').onClick();
    expect(brushTools.hollow).toHaveBeenCalledOnce();
    expect(brushTools.convexMerge).toHaveBeenCalledOnce();
  });

  it('flips horizontally and vertically', () => {
    const { entries, windowActions } = shellMenuEditTestRigCreate();
    const brushTools = brushToolsSpyCreate();
    windowActions.solidBrushTools = brushTools;
    shellTestMenuActionFind(entries, 'Flip Horizontally').onClick();
    shellTestMenuActionFind(entries, 'Flip Vertically').onClick();
    expect(brushTools.flip).toHaveBeenNthCalledWith(1, 'horizontal');
    expect(brushTools.flip).toHaveBeenNthCalledWith(2, 'vertical');
  });

  it('snaps vertices to the grid or to whole units', () => {
    const { entries, windowActions } = shellMenuEditTestRigCreate();
    const brushTools = brushToolsSpyCreate();
    windowActions.solidBrushTools = brushTools;
    shellTestMenuActionFind(entries, 'Snap Vertices', 'To Grid').onClick();
    shellTestMenuActionFind(entries, 'Snap Vertices', 'To Whole Units').onClick();
    expect(brushTools.snapVertices).toHaveBeenNthCalledWith(1, 'grid');
    expect(brushTools.snapVertices).toHaveBeenNthCalledWith(2, 'integer');
  });

  it('does nothing before the brush tools exist', () => {
    const { entries } = shellMenuEditTestRigCreate();
    expect(() => shellTestMenuActionFind(entries, 'CSG', 'Hollow').onClick()).not.toThrow();
  });
});

/** Select submenu of selection queries. */
describe('ShellMenuEdit select entries', () => {
  it('lists every selection query right after Select None and runs it by id', () => {
    const { entries, windowActions } = shellMenuEditTestRigCreate();
    const labels = shellTestMenuLabelsRead(entries);
    expect(labels[labels.indexOf('Select None') + 1]).toBe('Select');
    for (const query of selectionQueriesList()) {
      shellTestMenuActionFind(entries, 'Select', query.label).onClick();
      expect(windowActions.selectionQueryRun).toHaveBeenLastCalledWith(query.id);
    }
  });

  it('enables selection-based queries only while objects are selected', () => {
    const { entries, windowActions } = shellMenuEditTestRigCreate();
    for (const query of selectionQueriesList()) {
      const entry = shellTestMenuActionFind(entries, 'Select', query.label);
      expect(entry.isEnabled?.() ?? true).toBe(!query.needsSelection);
    }
    windowActions.clipboardSelectionHasObjects = true;
    for (const query of selectionQueriesList()) {
      expect(shellTestMenuActionFind(entries, 'Select', query.label).isEnabled?.() ?? true).toBe(true);
    }
  });
});
