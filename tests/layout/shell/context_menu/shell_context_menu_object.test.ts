import { afterEach, describe, expect, it } from 'vitest';
import { ShellContextMenuObject } from '@/layout/shell/context_menu/shell_context_menu_object.js';
import { ShellMenuEdit } from '@/layout/shell/menubar/menus/shell_menu_edit.js';
import { menuEntriesAvailableFilter } from '@/ui/menu/menu_entries_available.js';
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
} from '../shell_test_support.js';

/** Docks built by the running test. */
let shellContextMenuObjectTestDocks: ShellTestDocks | null = null;

/**
 * Builds the shown right-click menu entries for a selection state.
 *
 * @param hasSelection Whether objects are selected.
 * @param canRunCsgBoolean Whether the selection allows a mesh boolean.
 * @returns Entries after hiding rows that do not apply, and the context.
 */
function shellContextMenuObjectTestEntries(
  hasSelection: boolean,
  canRunCsgBoolean = false,
): { entries: ToolbarMenuEntry[]; context: ReturnType<typeof shellTestMenuContextCreate> } {
  shellContextMenuObjectTestDocks = shellTestDocksCreate();
  const windowActions = new ShellTestWindowActions();
  windowActions.clipboardSelectionHasObjects = hasSelection;
  const toolbarActions = shellTestToolbarActionsCreate({ canRunCsgBoolean: () => canRunCsgBoolean });
  const context = shellTestMenuContextCreate(shellContextMenuObjectTestDocks, toolbarActions, windowActions);
  return { entries: menuEntriesAvailableFilter(new ShellContextMenuObject().entriesBuild(context)), context };
}

afterEach(() => {
  if (shellContextMenuObjectTestDocks) {
    shellTestDocksDispose(shellContextMenuObjectTestDocks);
    shellContextMenuObjectTestDocks = null;
  }
  document.body.replaceChildren();
});

/**
 * Proves the right-click menu of the map views lists the selection commands on
 * selected objects and the paste, select and show commands on empty space,
 * hides rows that do not apply, nests at most one submenu level and reuses the
 * main menu rows with their shortcuts.
 */
describe('ShellContextMenuObject', () => {
  it('lists the commands that act on selected objects', () => {
    const labels = shellTestMenuLabelsRead(shellContextMenuObjectTestEntries(true).entries);
    for (const label of ['Cut', 'Copy', 'Duplicate', 'Delete', 'Object Properties', 'Group', 'Hollow', 'Align']) {
      expect(labels).toContain(label);
    }
    for (const label of ['Hide Selected', 'Isolate Selected', 'Frame Selection']) {
      expect(labels).toContain(label);
    }
  });

  it('hides Union, Subtract and Intersect unless the selection allows a mesh boolean', () => {
    const withoutBoolean = shellTestMenuLabelsRead(shellContextMenuObjectTestEntries(true, false).entries);
    expect(withoutBoolean).not.toContain('Union');
    document.body.replaceChildren();
    const withBoolean = shellTestMenuLabelsRead(shellContextMenuObjectTestEntries(true, true).entries);
    expect(withBoolean).toEqual(expect.arrayContaining(['Union', 'Subtract', 'Intersect']));
  });

  it('lists only pasting, selecting and Show All on empty space', () => {
    const labels = shellTestMenuLabelsRead(shellContextMenuObjectTestEntries(false).entries);
    expect(labels).toEqual(expect.arrayContaining(['Paste', 'Select All', 'Show All']));
    for (const label of ['Cut', 'Copy', 'Duplicate', 'Delete', 'Hollow', 'Hide Selected']) {
      expect(labels).not.toContain(label);
    }
  });

  it('nests at most one submenu level', () => {
    const { entries } = shellContextMenuObjectTestEntries(true);
    const nestedSubmenus = entries.filter(isMenuSubmenu).flatMap((submenu) => submenu.children.filter(isMenuSubmenu));
    expect(nestedSubmenus).toEqual([]);
  });

  it('reuses the main menu rows with their configured shortcuts', () => {
    const { entries, context } = shellContextMenuObjectTestEntries(true);
    const hollow = shellTestMenuActionFind(entries, 'Hollow');
    expect(shellTestMenuShortcutRead(hollow)).toBe(shellTestShortcutLabelFormat('csg_hollow'));
    const editDuplicate = shellTestMenuActionFind(new ShellMenuEdit().entriesBuild(context), 'Duplicate');
    expect(shellTestMenuShortcutRead(shellTestMenuActionFind(entries, 'Duplicate'))).toBe(
      shellTestMenuShortcutRead(editDuplicate),
    );
  });
});
