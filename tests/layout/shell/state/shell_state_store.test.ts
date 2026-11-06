import { afterEach, describe, expect, it } from 'vitest';
import { SHELL_STATE_STORAGE_KEY, ShellStateStore } from '@/layout/shell/state/shell_state_store.js';
import {
  SHELL_INSPECTOR_WIDTH_PREVIOUS_DEFAULT_PX,
  shellStateDefaultCreate,
} from '@/layout/shell/state/shell_state.js';
import { Theme } from '@/theme.js';
import {
  allowEditorStorageWritesForTests,
  performEditorFactoryReset,
} from '@/settings/storage/clear_editor_storage.js';

/**
 * Creates an in-memory storage.
 *
 * @returns Storage backed by a map.
 */
function memoryStorageCreate(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    removeItem: (key: string) => {
      values.delete(key);
    },
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

describe('ShellStateStore', () => {
  afterEach(() => {
    allowEditorStorageWritesForTests();
  });

  it('starts from the defaults when nothing is stored', () => {
    const store = new ShellStateStore(memoryStorageCreate());
    expect(store.getState()).toEqual(shellStateDefaultCreate());
  });

  it('restores panel visibility, sizes, tabs and splitter sizes in a new store', () => {
    const storage = memoryStorageCreate();
    const first = new ShellStateStore(storage);
    first.update({ inspectorVisible: false, inspectorWidthPx: 420, infoPanelTabId: 'issues', infoPanelHeightPx: 180 });
    first.splitSizeWrite('map_layers', 230);
    const second = new ShellStateStore(storage);
    const state = second.getState();
    expect(state.inspectorVisible).toBe(false);
    expect(state.inspectorWidthPx).toBe(420);
    expect(state.infoPanelTabId).toBe('issues');
    expect(state.infoPanelHeightPx).toBe(180);
    expect(second.splitSizeRead('map_layers', 1)).toBe(230);
    expect(second.splitSizeRead('unknown', 77)).toBe(77);
  });

  it('replaces malformed stored fields with defaults', () => {
    const storage = memoryStorageCreate();
    storage.setItem(
      SHELL_STATE_STORAGE_KEY,
      JSON.stringify({ inspectorVisible: 'yes', inspectorWidthPx: -5, splitSizesPx: { good: 40, bad: 'x' } }),
    );
    const state = new ShellStateStore(storage).getState();
    const defaults = shellStateDefaultCreate();
    expect(state.inspectorVisible).toBe(defaults.inspectorVisible);
    expect(state.inspectorWidthPx).toBe(defaults.inspectorWidthPx);
    expect(state.splitSizesPx).toEqual({ good: 40 });
  });

  it('loads state saved with the removed inspector tab without keeping the stale field', () => {
    const storage = memoryStorageCreate();
    const storedWidthPx = shellStateDefaultCreate().inspectorWidthPx + 40;
    storage.setItem(
      SHELL_STATE_STORAGE_KEY,
      JSON.stringify({ inspectorTabId: 'entity', inspectorWidthPx: storedWidthPx, unknownField: true }),
    );
    const state = new ShellStateStore(storage).getState();
    expect(state.inspectorWidthPx).toBe(storedWidthPx);
    expect(Object.keys(state)).not.toContain('inspectorTabId');
    expect(Object.keys(state)).not.toContain('unknownField');
    expect(Object.keys(state).sort()).toEqual(Object.keys(shellStateDefaultCreate()).sort());
  });

  it('starts with the info panel folded and the inspector at the right dock width token', () => {
    const state = new ShellStateStore(memoryStorageCreate()).getState();
    expect(state.infoPanelCollapsed).toBe(true);
    expect(state.inspectorWidthPx).toBe(Theme.rightDockWidthPx);
  });

  it('remembers the folded info panel and its expanded height in a new store', () => {
    const storage = memoryStorageCreate();
    const expandedHeightPx = shellStateDefaultCreate().infoPanelHeightPx + 37;
    new ShellStateStore(storage).update({ infoPanelCollapsed: false, infoPanelHeightPx: expandedHeightPx });
    const state = new ShellStateStore(storage).getState();
    expect(state.infoPanelCollapsed).toBe(false);
    expect(state.infoPanelHeightPx).toBe(expandedHeightPx);
  });

  it('replaces the inspector width earlier versions started with but keeps widths the user chose', () => {
    const storage = memoryStorageCreate();
    storage.setItem(
      SHELL_STATE_STORAGE_KEY,
      JSON.stringify({ inspectorWidthPx: SHELL_INSPECTOR_WIDTH_PREVIOUS_DEFAULT_PX }),
    );
    expect(new ShellStateStore(storage).getState().inspectorWidthPx).toBe(Theme.rightDockWidthPx);
    const chosenWidthPx = SHELL_INSPECTOR_WIDTH_PREVIOUS_DEFAULT_PX + 1;
    storage.setItem(SHELL_STATE_STORAGE_KEY, JSON.stringify({ inspectorWidthPx: chosenWidthPx }));
    expect(new ShellStateStore(storage).getState().inspectorWidthPx).toBe(chosenWidthPx);
  });

  it('falls back to defaults when the stored text is not JSON', () => {
    const storage = memoryStorageCreate();
    storage.setItem(SHELL_STATE_STORAGE_KEY, '{not json');
    expect(new ShellStateStore(storage).getState()).toEqual(shellStateDefaultCreate());
  });

  it('does not write while editor storage writes are suppressed', () => {
    const storage = memoryStorageCreate();
    const store = new ShellStateStore(storage);
    performEditorFactoryReset({ localStorage: memoryStorageCreate(), sessionStorage: null });
    store.update({ toolbarVisible: false });
    expect(storage.getItem(SHELL_STATE_STORAGE_KEY)).toBeNull();
  });
});
