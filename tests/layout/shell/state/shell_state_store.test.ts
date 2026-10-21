import { afterEach, describe, expect, it } from 'vitest';
import { SHELL_STATE_STORAGE_KEY, ShellStateStore } from '@/layout/shell/state/shell_state_store.js';
import { shellStateDefaultCreate } from '@/layout/shell/state/shell_state.js';
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
    first.update({ inspectorVisible: false, inspectorWidthPx: 420, inspectorTabId: 'face', infoPanelHeightPx: 180 });
    first.splitSizeWrite('map_layers', 230);
    const second = new ShellStateStore(storage);
    const state = second.getState();
    expect(state.inspectorVisible).toBe(false);
    expect(state.inspectorWidthPx).toBe(420);
    expect(state.inspectorTabId).toBe('face');
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
