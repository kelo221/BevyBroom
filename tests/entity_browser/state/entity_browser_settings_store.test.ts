import { afterEach, describe, expect, it } from 'vitest';
import {
  ENTITY_BROWSER_SETTINGS_STORAGE_KEY,
  EntityBrowserSettingsStore,
} from '@/entity_browser/state/entity_browser_settings_store.js';
import { ENTITY_BROWSER_VIEW_OPTIONS_DEFAULT } from '@/entity_browser/view/entity_browser_view_options.js';
import {
  allowEditorStorageWritesForTests,
  suppressEditorStorageWrites,
} from '@/settings/storage/clear_editor_storage.js';
import { MemorySettingsStorage } from '@/settings/storage/settings_storage.js';

/** The display choices of the entity browser survive restarts. */
describe('EntityBrowserSettingsStore', () => {
  afterEach(() => {
    allowEditorStorageWritesForTests();
  });

  it('starts with the defaults and reloads saved choices', () => {
    const storage = new MemorySettingsStorage();
    const first = new EntityBrowserSettingsStore(storage);
    expect(first.optionsRead()).toEqual(ENTITY_BROWSER_VIEW_OPTIONS_DEFAULT);
    const changed = { sortMode: 'name', groupByCategory: false, usedOnly: true, searchText: 'door' } as const;
    first.optionsUpdate(changed);
    expect(new EntityBrowserSettingsStore(storage).optionsRead()).toEqual(changed);
  });

  it('replaces malformed stored fields with defaults', () => {
    const storage = new MemorySettingsStorage();
    storage.setItem(
      ENTITY_BROWSER_SETTINGS_STORAGE_KEY,
      JSON.stringify({ sortMode: 'size', usedOnly: true, searchText: 3 }),
    );
    const options = new EntityBrowserSettingsStore(storage).optionsRead();
    expect(options.sortMode).toBe(ENTITY_BROWSER_VIEW_OPTIONS_DEFAULT.sortMode);
    expect(options.usedOnly).toBe(true);
    expect(options.searchText).toBe(ENTITY_BROWSER_VIEW_OPTIONS_DEFAULT.searchText);
    storage.setItem(ENTITY_BROWSER_SETTINGS_STORAGE_KEY, '{not json');
    expect(new EntityBrowserSettingsStore(storage).optionsRead()).toEqual(ENTITY_BROWSER_VIEW_OPTIONS_DEFAULT);
  });

  it('keeps changes in memory only while editor storage writes are suppressed', () => {
    const storage = new MemorySettingsStorage();
    const store = new EntityBrowserSettingsStore(storage);
    suppressEditorStorageWrites();
    store.optionsUpdate({ usedOnly: !ENTITY_BROWSER_VIEW_OPTIONS_DEFAULT.usedOnly });
    expect(store.optionsRead().usedOnly).toBe(!ENTITY_BROWSER_VIEW_OPTIONS_DEFAULT.usedOnly);
    expect(storage.getItem(ENTITY_BROWSER_SETTINGS_STORAGE_KEY)).toBeNull();
  });
});
