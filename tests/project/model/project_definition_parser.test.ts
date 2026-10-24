import { describe, expect, it } from 'vitest';
import { ProjectDefinitionParser } from '@/project/model/project_definition_parser.js';
import { PreviewLaunchCommandError } from '@/preview/launch/preview_launch_command.js';

/**
 * Builds the text of a project file.
 *
 * @param overrides Top-level fields replacing the defaults.
 * @returns Project file text.
 */
function projectJsonCreate(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    project_version: 1,
    project_id: 'game-a',
    name: 'Game A',
    asset_root: 'assets',
    material_catalog: 'broom/materials.json',
    level_directory: 'broom/levels',
    preview: {
      program: 'cargo',
      arguments: ['run', '--release', '-p', 'game', '--', '--project', 'broom.project.json'],
      working_directory: '.',
      endpoint: 'http://127.0.0.1:15702',
    },
    ...overrides,
  });
}

/** Project files become the definitions the editor starts and builds games with. */
describe('ProjectDefinitionParser', () => {
  it('resolves identity, asset root and commands against the project directory', () => {
    const directory = 'C:/Games/My Game';
    const definition = ProjectDefinitionParser.parse(projectJsonCreate(), `${directory}\\broom.project.json`);
    expect(definition.projectIdentifier).toBe('game-a');
    expect(definition.name).toBe('Game A');
    expect(definition.projectDirectory).toBe(directory);
    expect(definition.projectFile).toBe(`${directory}/broom.project.json`);
    expect(definition.assetRoot).toBe(`${directory}/assets`);
    expect(definition.levelDirectory).toBe(`${definition.assetRoot}/broom/levels`);
    expect(definition.launch.workingDirectory).toBe(directory);
    expect(definition.launch.endpoint).toBe('http://127.0.0.1:15702');
  });

  it('keeps paths with spaces and non-ASCII characters intact', () => {
    const directory = '/home/jörg/Spiele mit Leerzeichen/ゲーム';
    const definition = ProjectDefinitionParser.parse(
      projectJsonCreate({ asset_root: 'Assets Ünïcode' }),
      `${directory}/broom.project.json`,
    );
    expect(definition.assetRoot).toBe(`${directory}/Assets Ünïcode`);
    expect(definition.launch.workingDirectory).toBe(directory);
  });

  it('derives a cargo build from a cargo run launch with short compiler messages', () => {
    const definition = ProjectDefinitionParser.parse(projectJsonCreate(), '/game/broom.project.json');
    expect(definition.build?.program).toBe('cargo');
    expect(definition.build?.arguments).toEqual(['build', '--release', '-p', 'game', '--message-format=short']);
    expect(definition.build?.workingDirectory).toBe(definition.launch.workingDirectory);
  });

  it('prefers an explicit build section and has no build for other programs', () => {
    const explicit = ProjectDefinitionParser.parse(
      projectJsonCreate({
        preview: {
          program: 'bin/game.exe',
          build: { program: 'make', arguments: ['game'], working_directory: 'source' },
        },
      }),
      '/game/broom.project.json',
    );
    expect(explicit.build).toEqual({
      program: 'make',
      arguments: ['game'],
      workingDirectory: '/game/source',
      endpoint: '',
    });
    const none = ProjectDefinitionParser.parse(
      projectJsonCreate({ preview: { program: 'bin/game.exe' } }),
      '/game/broom.project.json',
    );
    expect(none.build).toBeNull();
  });

  it('names the field that is missing or escapes the project', () => {
    expect(() => ProjectDefinitionParser.parse(projectJsonCreate({ project_id: '' }), '/g/broom.project.json')).toThrow(
      /project_id/,
    );
    expect(() =>
      ProjectDefinitionParser.parse(projectJsonCreate({ asset_root: '../outside' }), '/g/broom.project.json'),
    ).toThrow(PreviewLaunchCommandError);
    expect(() =>
      ProjectDefinitionParser.parse(projectJsonCreate({ level_directory: '../levels' }), '/g/broom.project.json'),
    ).toThrow(/level_directory/);
    expect(() => ProjectDefinitionParser.parse('{ not json', '/g/broom.project.json')).toThrow(/not valid JSON/);
  });
});
