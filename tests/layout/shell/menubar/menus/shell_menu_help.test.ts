import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShellMenuHelp } from '@/layout/shell/menubar/menus/shell_menu_help.js';
import {
  shellTestDocksCreate,
  shellTestDocksDispose,
  shellTestMenuActionFind,
  shellTestMenuContextCreate,
  shellTestMenuLabelsRead,
  shellTestMenuShortcutRead,
  shellTestShortcutLabelFormat,
  type ShellTestDocks,
} from '../../shell_test_support.js';

/** Docks built by the running test. */
let shellMenuHelpTestDocks: ShellTestDocks | null = null;

afterEach(() => {
  if (shellMenuHelpTestDocks) {
    shellTestDocksDispose(shellMenuHelpTestDocks);
    shellMenuHelpTestDocks = null;
  }
  document.body.replaceChildren();
});

/**
 * Proves the Help menu lists Search Commands first, with its configured
 * shortcut, exactly when the window offers a command search, and that the row
 * opens it.
 */
describe('ShellMenuHelp command search entry', () => {
  it('lists Search Commands first with its shortcut and opens the search', () => {
    shellMenuHelpTestDocks = shellTestDocksCreate();
    const commandSearchOpen = vi.fn();
    const context = { ...shellTestMenuContextCreate(shellMenuHelpTestDocks), commandSearchOpen };
    const entries = new ShellMenuHelp().entriesBuild(context);
    expect(shellTestMenuLabelsRead(entries)[0]).toBe('Search Commands\u2026');
    const searchRow = shellTestMenuActionFind(entries, 'Search Commands\u2026');
    expect(shellTestMenuShortcutRead(searchRow)).toBe(shellTestShortcutLabelFormat('command_search'));
    searchRow.onClick();
    expect(commandSearchOpen).toHaveBeenCalledOnce();
  });

  it('leaves the row out when the window has no command search', () => {
    shellMenuHelpTestDocks = shellTestDocksCreate();
    const entries = new ShellMenuHelp().entriesBuild(shellTestMenuContextCreate(shellMenuHelpTestDocks));
    expect(shellTestMenuLabelsRead(entries)).not.toContain('Search Commands\u2026');
    expect(entries[0]?.kind).not.toBe('separator');
  });
});
