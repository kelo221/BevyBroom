import { afterEach, describe, expect, it } from 'vitest';
import { GameProcessHost } from '@/desktop/bun/game_process/game_process_host.js';
import { gameProcessProjectReaderNodeCreate } from '@/desktop/bun/game_process/game_process_project_reader.js';
import { projectLevelRpcHandlersCreate } from '@/desktop/bun/project_levels/project_level_rpc_handlers.js';
import { GameProcessSpawnerFake } from '../game_process/game_process_spawner_fake.js';
import {
  projectLevelTestDirectoriesRemove,
  projectLevelTestDirectoryCreate,
  projectLevelTestDocumentWrite,
  projectLevelTestProjectWrite,
} from './project_level_test_project.js';

afterEach(() => projectLevelTestDirectoriesRemove());

/**
 * Unit tests for the desktop requests that serve the open project's level
 * documents.
 */
describe('projectLevelRpcHandlersCreate', () => {
  it('refuses every request without an open project', () => {
    const host = new GameProcessHost(new GameProcessSpawnerFake(), gameProcessProjectReaderNodeCreate());
    const handlers = projectLevelRpcHandlersCreate(host);
    expect(handlers.projectLevelList().ok).toBe(false);
    expect(handlers.projectLevelRead({ document: 'a.json' }).ok).toBe(false);
    expect(handlers.projectLevelWrite({ document: 'a.json', text: '{}', knownModifiedMilliseconds: null }).ok).toBe(
      false,
    );
    expect(handlers.projectLevelCreate({ name: 'a', text: '{}' }).ok).toBe(false);
    expect(handlers.projectLevelRename({ document: 'a.json', name: 'b' }).ok).toBe(false);
  });

  it('lists, creates, writes, reads and renames the levels of the open project', async () => {
    const definition = projectLevelTestProjectWrite(projectLevelTestDirectoryCreate(), [
      { id: 'hall', name: 'Hall', document: 'hall.json' },
    ]);
    projectLevelTestDocumentWrite(definition, 'hall.json', '{"hall":1}');
    const host = new GameProcessHost(new GameProcessSpawnerFake(), gameProcessProjectReaderNodeCreate());
    expect((await host.projectOpen(definition.projectFile)).ok).toBe(true);
    const handlers = projectLevelRpcHandlersCreate(host);
    const created = handlers.projectLevelCreate({ name: 'Pit', text: '{"pit":1}' });
    expect(created.ok).toBe(true);
    const listed = handlers.projectLevelList();
    expect(listed.ok ? listed.levels.map((level) => level.document) : listed).toEqual(['hall.json', 'pit.json']);
    expect(listed.ok ? listed.documentDirectory : '').toBe(definition.documentDirectory);
    const written = handlers.projectLevelWrite({
      document: 'pit.json',
      text: '{"pit":2}',
      knownModifiedMilliseconds: null,
    });
    expect(written.ok).toBe(true);
    const read = handlers.projectLevelRead({ document: 'pit.json' });
    expect(read.ok ? read.text : read.message).toBe('{"pit":2}');
    const renamed = handlers.projectLevelRename({ document: 'pit.json', name: 'Deep Pit' });
    expect(renamed.ok ? renamed.level.document : renamed.message).toBe('deep_pit.json');
    const relisted = handlers.projectLevelList();
    expect(relisted.ok ? relisted.levels.map((level) => level.id) : relisted).toEqual(['hall', 'deep_pit']);
  });
});
