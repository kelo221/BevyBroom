import { describe, expect, it } from 'vitest';
import { MemorySettingsStorage } from '@/settings/storage/settings_storage.js';
import {
  PROJECT_WORKSPACE_LAST_STORAGE_KEY,
  ProjectWorkspaceLastStore,
} from '@/project/workspace/project_workspace_last_store.js';

/**
 * The last open project and level survive the editor closing, and damaged
 * stored values read as nothing remembered.
 */
describe('ProjectWorkspaceLastStore', () => {
  it('reads back what it wrote through a new store on the same storage', () => {
    const storage = new MemorySettingsStorage();
    const workspace = { projectFile: '/games/cart/broom.project.json', levelDocument: 'lv-store.scene.json' };
    new ProjectWorkspaceLastStore(storage).write(workspace);
    expect(new ProjectWorkspaceLastStore(storage).read()).toEqual(workspace);
  });

  it('forgets the workspace when cleared', () => {
    const store = new ProjectWorkspaceLastStore(new MemorySettingsStorage());
    store.write({ projectFile: '/games/cart/broom.project.json', levelDocument: null });
    store.clear();
    expect(store.read()).toBeNull();
  });

  it('reads damaged values as nothing remembered and a missing level as none', () => {
    const storage = new MemorySettingsStorage();
    const store = new ProjectWorkspaceLastStore(storage);
    storage.setItem(PROJECT_WORKSPACE_LAST_STORAGE_KEY, '{not json');
    expect(store.read()).toBeNull();
    storage.setItem(PROJECT_WORKSPACE_LAST_STORAGE_KEY, JSON.stringify({ levelDocument: 'a.json' }));
    expect(store.read()).toBeNull();
    storage.setItem(PROJECT_WORKSPACE_LAST_STORAGE_KEY, JSON.stringify({ projectFile: 'p.json', levelDocument: 7 }));
    expect(store.read()).toEqual({ projectFile: 'p.json', levelDocument: null });
  });
});
