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
    levelDirectory: `${root}/assets/broom/levels`,
    documentDirectory: `${root}/broom/documents`,
    levels: [],
    textureDirectories: [],
    sprinkleDirectories: [],
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

  it('warns about each texture directory that is not a directory under the asset root', () => {
    const root = '/games/textured';
    const definition = definitionCreate(root);
    definition.textureDirectories = ['textures', 'missing/walls'];
    const probe = probeCreate(
      [root, `${root}/assets`, `${root}/source`, `${root}/assets/textures`],
      [`${root}/bin/game.exe`],
    );
    const problems = ProjectDefinitionValidator.validate(definition, probe);
    expect(problems).toEqual([
      { severity: 'warning', message: expect.stringContaining(`${root}/assets/missing/walls`) },
    ]);
  });

  it('warns about each sprinkle directory that is not a directory under the asset root', () => {
    const root = '/games/sprinkled';
    const definition = definitionCreate(root);
    definition.sprinkleDirectories = ['sprinkle', 'missing/foliage'];
    const probe = probeCreate(
      [root, `${root}/assets`, `${root}/source`, `${root}/assets/sprinkle`],
      [`${root}/bin/game.exe`],
    );
    const problems = ProjectDefinitionValidator.validate(definition, probe);
    expect(problems).toEqual([
      { severity: 'warning', message: expect.stringMatching(/sprinkle directory .*assets\/missing\/foliage/) },
    ]);
  });

  it('warns about each listed level whose document is not a file in the document directory', () => {
    const root = '/games/leveled';
    const definition = definitionCreate(root);
    definition.levels = [
      { id: 'hall', name: 'Hall', document: 'hall.json' },
      { id: 'pit', name: 'Pit', document: 'arenas/pit.json' },
    ];
    const probe = probeCreate(
      [root, `${root}/assets`, `${root}/source`],
      [`${root}/bin/game.exe`, `${root}/broom/documents/hall.json`],
    );
    const problems = ProjectDefinitionValidator.validate(definition, probe);
    expect(problems).toEqual([
      { severity: 'warning', message: expect.stringMatching(/broom\/documents\/arenas\/pit\.json.*"pit"/) },
    ]);
  });
});
