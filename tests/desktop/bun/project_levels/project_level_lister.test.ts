import { afterEach, describe, expect, it } from 'vitest';
import { ProjectLevelLister } from '@/desktop/bun/project_levels/project_level_lister.js';
import { ProjectLevelPaths } from '@/desktop/bun/project_levels/project_level_paths.js';
import {
  projectLevelTestDirectoriesRemove,
  projectLevelTestDirectoryCreate,
  projectLevelTestDocumentWrite,
  projectLevelTestFileWrite,
  projectLevelTestProjectWrite,
} from './project_level_test_project.js';

afterEach(() => projectLevelTestDirectoriesRemove());

/** The lister finds the levels a project lists and the documents it holds. */
describe('ProjectLevelLister', () => {
  it('lists explicit levels first in file order, then discovered documents sorted by path', () => {
    const definition = projectLevelTestProjectWrite(projectLevelTestDirectoryCreate(), [
      { id: 'zeta', name: 'Zeta Hall', document: 'zeta.json' },
      { id: 'alpha', document: 'nested/alpha.json' },
    ]);
    ['zeta.json', 'nested/alpha.json', 'beta.json', 'nested/deep/Gamma Room.json'].forEach((document) =>
      projectLevelTestDocumentWrite(definition, document, '{}'),
    );
    projectLevelTestFileWrite(definition.documentDirectory, 'notes.txt', 'not a level');
    const levels = ProjectLevelLister.list(definition);
    expect(levels.map((level) => [level.id, level.name, level.document, level.isListed])).toEqual([
      ['zeta', 'Zeta Hall', 'zeta.json', true],
      ['alpha', 'alpha', 'nested/alpha.json', true],
      ['beta', 'beta', 'beta.json', false],
      ['nested_deep_gamma_room', 'Gamma Room', 'nested/deep/Gamma Room.json', false],
    ]);
    levels.forEach((level) => expect(level.modifiedMilliseconds).toBeGreaterThan(0));
  });

  it('keeps listed levels whose document is missing, with no modification time', () => {
    const definition = projectLevelTestProjectWrite(projectLevelTestDirectoryCreate(), [
      { id: 'planned', document: 'planned.json' },
    ]);
    const levels = ProjectLevelLister.list(definition);
    expect(levels).toEqual([
      { id: 'planned', name: 'planned', document: 'planned.json', modifiedMilliseconds: null, isListed: true },
    ]);
  });

  it('lists nothing for a project without a document directory on disk', () => {
    const definition = projectLevelTestProjectWrite(projectLevelTestDirectoryCreate());
    expect(ProjectLevelLister.list(definition)).toEqual([]);
  });
});

/** Document path rules shared by the reader and writer. */
describe('ProjectLevelPaths', () => {
  it('refuses paths that escape the document directory, are not documents or name no file', () => {
    expect(ProjectLevelPaths.refusalDescribe('../outside.json')).toMatch(/inside the document directory/);
    expect(ProjectLevelPaths.refusalDescribe('/abs/castle.json')).toMatch(/inside the document directory/);
    expect(ProjectLevelPaths.refusalDescribe('')).toMatch(/inside the document directory/);
    expect(ProjectLevelPaths.refusalDescribe('castle.txt')).toMatch(/\.json/);
    expect(ProjectLevelPaths.refusalDescribe('nested/castle.json')).toBeNull();
    expect(ProjectLevelPaths.refusalDescribe('./Castle Hall.JSON')).toBeNull();
  });
});
