import { describe, expect, it } from 'vitest';
import type { ProjectDefinition } from '@/project/model/project_definition.js';
import {
  ProjectDefinitionValidator,
  type ProjectFileSystemProbe,
} from '@/project/model/project_definition_validator.js';

/**
 * Builds a probe that knows exactly the given directories and files.
 *
 * @param directories Existing directories.
 * @param files Existing files.
 * @returns File system probe.
 */
function probeCreate(directories: string[], files: string[]): ProjectFileSystemProbe {
  return { isDirectory: (path) => directories.includes(path), isFile: (path) => files.includes(path) };
}

/**
 * Builds a project rooted at a directory with a game executable launch.
 *
 * @param root Project directory.
 * @returns Project definition.
 */
function definitionCreate(root: string): ProjectDefinition {
  return {
    projectFile: `${root}/broom.project.json`,
    projectDirectory: root,
    projectIdentifier: 'game',
    name: 'Game',
    assetRoot: `${root}/assets`,
    launch: { program: 'bin/game.exe', arguments: [], workingDirectory: root, endpoint: 'http://127.0.0.1:15702' },
    build: { program: 'cargo', arguments: ['build'], workingDirectory: `${root}/source`, endpoint: '' },
  };
}

/** The validator explains every reason a project's game cannot start. */
describe('ProjectDefinitionValidator', () => {
  it('finds nothing wrong with a complete project', () => {
    const root = '/games/Spiel mit Ümlaut';
    const probe = probeCreate([root, `${root}/assets`, `${root}/source`], [`${root}/bin/game.exe`]);
    expect(ProjectDefinitionValidator.validate(definitionCreate(root), probe)).toEqual([]);
  });

  it('reports a missing asset root, program and build directory as errors', () => {
    const root = '/games/broken';
    const problems = ProjectDefinitionValidator.validate(definitionCreate(root), probeCreate([root], []));
    const messages = problems.map((problem) => problem.message).join('\n');
    expect(problems.every((problem) => problem.severity === 'error')).toBe(true);
    expect(messages).toContain(`${root}/assets`);
    expect(messages).toContain(`${root}/bin/game.exe`);
    expect(messages).toContain(`${root}/source`);
  });

  it('does not look up programs found through PATH and warns about remote endpoints', () => {
    const root = '/games/remote';
    const definition = definitionCreate(root);
    definition.launch = { ...definition.launch, program: 'cargo', endpoint: 'http://example.com:15702' };
    const problems = ProjectDefinitionValidator.validate(
      definition,
      probeCreate([root, `${root}/assets`, `${root}/source`], []),
    );
    expect(problems).toEqual([{ severity: 'warning', message: expect.stringContaining('example.com') }]);
  });
});
