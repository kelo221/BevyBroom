import { afterEach, describe, expect, it } from 'vitest';
import { ShellMenuEdit } from '@/layout/shell/menubar/menus/shell_menu_edit.js';
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
