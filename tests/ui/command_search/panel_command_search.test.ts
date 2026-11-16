import { afterEach, describe, expect, it, vi } from 'vitest';
import { PanelCommandSearch } from '@/ui/command_search/panel_command_search.js';
import type { ToolbarMenuAction } from '@/ui/menu/menu_types.js';
import { commandSearchTestSourceCreate } from './command_search_test_support.js';

/** Command search under test with the actions of its menus. */
interface PanelCommandSearchTestRig {
  readonly search: PanelCommandSearch;
  readonly union: ToolbarMenuAction & { onClick: ReturnType<typeof vi.fn> };
  readonly subtract: ToolbarMenuAction & { onClick: ReturnType<typeof vi.fn> };
  readonly save: ToolbarMenuAction & { onClick: ReturnType<typeof vi.fn> };
}

/** Search built by the running test. */
let panelCommandSearchTestOpen: PanelCommandSearch | null = null;

/**
 * Builds a command search over a File and an Edit menu.
 *
 * @param isSubtractEnabled Whether the Subtract command can run.
 * @returns Search and the actions it finds.
 */
function panelCommandSearchTestRigCreate(isSubtractEnabled = true): PanelCommandSearchTestRig {
  const union = { label: 'Union', onClick: vi.fn(), shortcut: 'Ctrl+Shift+U' };
  const subtract = { label: 'Subtract', onClick: vi.fn(), isEnabled: () => isSubtractEnabled };
  const save = { label: 'Save', onClick: vi.fn() };
  const search = new PanelCommandSearch(document, () => [
    commandSearchTestSourceCreate('File', [save]),
    commandSearchTestSourceCreate('Edit', [{ kind: 'submenu', label: 'CSG', children: [union, subtract] }]),
  ]);
  panelCommandSearchTestOpen = search;
  return { search, union, subtract, save };
}

/**
 * Returns the search field.
 *
 * @returns Focused search input.
 */
function panelCommandSearchTestInput(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>('[data-command-search] input');
  if (!input) {
    throw new Error('Command search field not found');
  }
  return input;
}

/**
 * Types a query into the search field like a user.
 *
 * @param query Text typed.
 */
function panelCommandSearchTestType(query: string): void {
  const input = panelCommandSearchTestInput();
  input.value = query;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Presses a key in the search field.
 *
 * @param key Key value.
 * @returns The dispatched event.
 */
function panelCommandSearchTestKey(key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  panelCommandSearchTestInput().dispatchEvent(event);
  return event;
}

/**
 * Reads the shown result rows as label and path text.
 *
 * @returns Result labels with their paths.
 */
function panelCommandSearchTestRows(): string[] {
  return [...document.querySelectorAll<HTMLElement>('[data-command-search] [role="option"]')].map(
    (row) => row.querySelector('.command-search-label')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
  );
}

afterEach(() => {
  panelCommandSearchTestOpen?.close();
  panelCommandSearchTestOpen = null;
  document.body.replaceChildren();
});

/**
 * Proves the command search opens with a focused field listing every menu
 * command, narrows the list while typing, moves with the arrow keys, runs the
 * active command with Enter or a click, never runs disabled commands, keeps its
 * keys from the editor shortcuts, lists recent commands first and closes on
 * Escape or a click outside.
 */
describe('PanelCommandSearch', () => {
  it('opens with a focused field listing every command with its menu path', () => {
    const { search } = panelCommandSearchTestRigCreate();
    search.open();
    expect(search.isOpen()).toBe(true);
    expect(document.activeElement).toBe(panelCommandSearchTestInput());
    expect(panelCommandSearchTestRows()).toEqual(['Save File', 'Union Edit \u203a CSG', 'Subtract Edit \u203a CSG']);
  });

  it('narrows the results while typing and runs the active one with Enter', () => {
    const { search, union } = panelCommandSearchTestRigCreate();
    search.open();
    panelCommandSearchTestType('uni');
    expect(panelCommandSearchTestRows()).toEqual(['Union Edit \u203a CSG']);
    const enter = panelCommandSearchTestKey('Enter');
    expect(enter.defaultPrevented).toBe(true);
    expect(union.onClick).toHaveBeenCalledTimes(1);
    expect(search.isOpen()).toBe(false);
  });

  it('moves the active row with the arrow keys, wrapping at both ends', () => {
    const { search, save, subtract } = panelCommandSearchTestRigCreate();
    search.open();
    panelCommandSearchTestKey('ArrowUp');
    panelCommandSearchTestKey('Enter');
    expect(subtract.onClick).toHaveBeenCalledTimes(1);
    search.open();
    panelCommandSearchTestKey('ArrowDown');
    panelCommandSearchTestKey('ArrowDown');
    panelCommandSearchTestKey('ArrowDown');
    panelCommandSearchTestKey('ArrowDown');
    panelCommandSearchTestKey('Enter');
    expect(save.onClick).toHaveBeenCalledTimes(1);
  });

  it('keeps disabled commands listed but never runs them', () => {
    const { search, subtract } = panelCommandSearchTestRigCreate(false);
    search.open();
    panelCommandSearchTestType('subtract');
    panelCommandSearchTestKey('Enter');
    expect(subtract.onClick).not.toHaveBeenCalled();
    expect(search.isOpen()).toBe(true);
  });

  it('runs a clicked result', () => {
    const { search, save } = panelCommandSearchTestRigCreate();
    search.open();
    document.querySelector<HTMLButtonElement>('[data-command-search] [role="option"]')?.click();
    expect(save.onClick).toHaveBeenCalledTimes(1);
    expect(search.isOpen()).toBe(false);
  });

  it('keeps its keys from the editor shortcuts on the window', () => {
    const { search } = panelCommandSearchTestRigCreate();
    const windowKeydown = vi.fn();
    window.addEventListener('keydown', windowKeydown);
    search.open();
    panelCommandSearchTestKey('a');
    window.removeEventListener('keydown', windowKeydown);
    expect(windowKeydown).not.toHaveBeenCalled();
  });

  it('lists the recently run command first while the field is empty', () => {
    const { search } = panelCommandSearchTestRigCreate();
    search.open();
    panelCommandSearchTestType('subtract');
    panelCommandSearchTestKey('Enter');
    search.open();
    expect(panelCommandSearchTestRows()[0]).toBe('Subtract Edit \u203a CSG');
  });

  it('closes on Escape and on a press outside', () => {
    const { search } = panelCommandSearchTestRigCreate();
    search.open();
    panelCommandSearchTestKey('Escape');
    expect(search.isOpen()).toBe(false);
    search.open();
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(search.isOpen()).toBe(false);
  });
});
