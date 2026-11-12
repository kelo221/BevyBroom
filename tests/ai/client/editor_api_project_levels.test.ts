import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { EditorApi } from '@/ai/client/editor_api.js';
import { MCP_TOOL_DEFINITIONS } from '@/ai/server/registry_mcp_tool.js';
import { GAME_PROCESS_DESKTOP_ONLY_MESSAGE } from '@/project/control/game_process_control.js';
import type { ProjectLevelActions } from '@/project/level/project_level_actions.js';
import type { ProjectLevelService } from '@/project/level/project_level_service.js';
import type { ProjectLevelSummary } from '@/project/level/project_level_types.js';
import { editorApiTestHostCreate } from './editor_api_test_host.js';

/**
 * Builds a level summary.
 *
 * @param id Level id.
 * @returns Level summary with a document named after the id.
 */
function levelSummaryCreate(id: string): ProjectLevelSummary {
  return { id, name: id, document: `${id}.json`, modifiedMilliseconds: 1, isListed: false };
}

/**
 * Builds fake level actions over a fixed level list.
 *
 * @param isAvailable Whether the desktop app manages project files.
 * @returns Fake actions and their spies.
 */
function levelActionsFakeCreate(isAvailable: boolean) {
  const levels = [levelSummaryCreate('hall'), levelSummaryCreate('cellar')];
  const service = {
    refresh: vi.fn(async () => undefined),
    listStateRead: () => ({ levels, documentDirectory: '/game/broom/documents', message: null, isAvailable }),
    openLevelRead: () => null,
    levelFind: (key: string) => levels.find((level) => level.id === key || level.document === key) ?? null,
  } as unknown as ProjectLevelService;
  const actions = {
    serviceRead: () => service,
    levelOpen: vi.fn(async (document: string) => ({
      ok: true,
      level: levelSummaryCreate(document.replace('.json', '')),
    })),
    levelSave: vi.fn(async () => ({ ok: false, message: 'changed elsewhere', refusal: 'changed_on_disk' })),
    levelSaveAsNew: vi.fn(async (name: string) => ({ ok: true, level: levelSummaryCreate(name) })),
  } as unknown as ProjectLevelActions;
  return { actions, levels };
}

/**
 * Builds an editor API whose host offers the given level actions.
 *
 * @param actions Level actions, or undefined for a host without them.
 * @returns Editor API.
 */
function levelApiCreate(actions: ProjectLevelActions | undefined): EditorApi {
  const parts = editorApiTestHostCreate({
    worldObject: new THREE.Group(),
    ...(actions ? { projectLevelActionsRead: () => actions } : {}),
  });
  return new EditorApi(parts.host);
}

describe('EditorApiProjectLevels', () => {
  it('registers the project level tools', () => {
    const names = MCP_TOOL_DEFINITIONS.map((definition) => definition.name);
    expect(names).toEqual(expect.arrayContaining(['list_project_levels', 'open_project_level', 'save_project_level']));
  });

  it('lists the levels after refreshing them', async () => {
    const fake = levelActionsFakeCreate(true);
    const result = await levelApiCreate(fake.actions).invokeToolAsync('list_project_levels');
    expect(result.ok).toBe(true);
    expect((result.data as { levels: ProjectLevelSummary[] }).levels.map((level) => level.id)).toEqual([
      'hall',
      'cellar',
    ]);
    expect(fake.actions.serviceRead().refresh).toHaveBeenCalled();
  });

  it('opens a level by id or document and refuses unknown levels', async () => {
    const fake = levelActionsFakeCreate(true);
    const api = levelApiCreate(fake.actions);
    expect((await api.invokeToolAsync('open_project_level', { levelId: 'cellar' })).ok).toBe(true);
    expect(fake.actions.levelOpen).toHaveBeenCalledWith('cellar.json', true);
    expect((await api.invokeToolAsync('open_project_level', { document: 'hall.json' })).ok).toBe(true);
    expect((await api.invokeToolAsync('open_project_level', { levelId: 'attic' })).ok).toBe(false);
    expect((await api.invokeToolAsync('open_project_level', {})).ok).toBe(false);
  });

  it('saves into a new level with a name and passes on a refused write-back', async () => {
    const fake = levelActionsFakeCreate(true);
    const api = levelApiCreate(fake.actions);
    const created = await api.invokeToolAsync('save_project_level', { name: 'Tower' });
    expect(created.ok).toBe(true);
    expect(fake.actions.levelSaveAsNew).toHaveBeenCalledWith('Tower');
    const refused = await api.invokeToolAsync('save_project_level');
    expect(refused).toMatchObject({ ok: false, data: { refusal: 'changed_on_disk' } });
  });

  it('explains that project levels need the desktop app', async () => {
    for (const api of [levelApiCreate(undefined), levelApiCreate(levelActionsFakeCreate(false).actions)]) {
      const result = await api.invokeToolAsync('list_project_levels');
      expect(result).toMatchObject({ ok: false, message: GAME_PROCESS_DESKTOP_ONLY_MESSAGE });
    }
  });
});
