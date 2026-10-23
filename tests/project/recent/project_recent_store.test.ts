import { describe, expect, it } from 'vitest';
import { MemorySettingsStorage } from '@/settings/storage/settings_storage.js';
import { PROJECT_RECENT_LIMIT, ProjectRecentStore } from '@/project/recent/project_recent_store.js';

/**
 * Unit tests for the recent projects list: newest first, no duplicates, bounded
 * length, persisted across store instances, and tolerant of bad stored data.
 */
describe('ProjectRecentStore', () => {
  it('keeps the newest project first without duplicates and persists it', () => {
    const storage = new MemorySettingsStorage();
    const store = new ProjectRecentStore(storage);
    store.remember('C:/games/first/broom.project.json');
    store.remember('C:/games/second space/broom.project.json');
    store.remember('C:/games/first/broom.project.json');
    const expected = ['C:/games/first/broom.project.json', 'C:/games/second space/broom.project.json'];
    expect(store.listRead()).toEqual(expected);
    expect(new ProjectRecentStore(storage).listRead()).toEqual(expected);
  });

  it('drops the oldest projects beyond the limit and forgets removed ones', () => {
    const store = new ProjectRecentStore(null);
    const paths = Array.from({ length: PROJECT_RECENT_LIMIT + 2 }, (_, index) => `/projects/p${index}.json`);
    paths.forEach((path) => store.remember(path));
    expect(store.listRead()).toHaveLength(PROJECT_RECENT_LIMIT);
    expect(store.listRead()[0]).toBe(paths[paths.length - 1]);
    store.forget(paths[paths.length - 1] ?? '');
    expect(store.listRead()).not.toContain(paths[paths.length - 1]);
  });

  it('ignores stored values that are not a list of paths', () => {
    expect(ProjectRecentStore.listSanitize({ broken: true })).toEqual([]);
    expect(ProjectRecentStore.listSanitize(['/a.json', 3, '', '/a.json', '/ünï/b.json'])).toEqual([
      '/a.json',
      '/ünï/b.json',
    ]);
  });
});
