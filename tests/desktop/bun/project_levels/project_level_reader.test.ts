import { afterEach, describe, expect, it } from 'vitest';
import { ProjectLevelReader } from '@/desktop/bun/project_levels/project_level_reader.js';
import {
  projectLevelTestDirectoriesRemove,
  projectLevelTestDirectoryCreate,
  projectLevelTestDocumentWrite,
  projectLevelTestFileWrite,
  projectLevelTestLinkWrite,
  projectLevelTestProjectWrite,
} from './project_level_test_project.js';

afterEach(() => projectLevelTestDirectoriesRemove());

/** The reader returns level documents and refuses everything else. */
describe('ProjectLevelReader', () => {
  it('reads a document with the level it belongs to, taking id and name from the project file', () => {
    const definition = projectLevelTestProjectWrite(projectLevelTestDirectoryCreate(), [
      { id: 'hall', name: 'Castle Hall', document: 'castle_hall.json' },
    ]);
    projectLevelTestDocumentWrite(definition, 'castle_hall.json', '{"version":1,"objects":[]}');
    const read = new ProjectLevelReader().read(definition, './castle_hall.json');
    expect(read.ok).toBe(true);
    if (read.ok) {
      expect(read.text).toBe('{"version":1,"objects":[]}');
      expect(read.level.id).toBe('hall');
      expect(read.level.name).toBe('Castle Hall');
      expect(read.level.isListed).toBe(true);
      expect(read.level.modifiedMilliseconds).toBeGreaterThan(0);
    }
  });

  it('refuses paths outside the document directory, other file kinds, links that leave it and large files', () => {
    const projectDirectory = projectLevelTestDirectoryCreate();
    const definition = projectLevelTestProjectWrite(projectDirectory);
    projectLevelTestFileWrite(projectDirectory, 'secret.json', '{"secret":true}');
    projectLevelTestDocumentWrite(definition, 'notes.txt', 'text');
    projectLevelTestDocumentWrite(definition, 'big.json', 'x'.repeat(64));
    projectLevelTestLinkWrite(definition.documentDirectory, 'link.json', `${projectDirectory}/secret.json`);
    const reader = new ProjectLevelReader(32);
    const refused = [
      reader.read(definition, '../secret.json'),
      reader.read(definition, 'notes.txt'),
      reader.read(definition, 'link.json'),
      reader.read(definition, 'big.json'),
      reader.read(definition, 'missing.json'),
    ];
    expect(refused.map((result) => result.ok)).toEqual([false, false, false, false, false]);
    expect(refused.map((result) => (result.ok ? '' : result.message))).toEqual([
      expect.stringContaining('inside the document directory'),
      expect.stringContaining('.json'),
      expect.stringContaining('outside the document directory'),
      expect.stringContaining('exceed the limit'),
      expect.stringContaining('missing.json'),
    ]);
  });
});
