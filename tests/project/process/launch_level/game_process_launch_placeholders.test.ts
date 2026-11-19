import { describe, expect, it } from 'vitest';
import { ProjectDefinitionParser } from '@/project/model/project_definition_parser.js';
import type { ProjectDefinition } from '@/project/model/project_definition.js';
import {
  GAME_PROCESS_LAUNCH_PLACEHOLDER_NAMES,
  GameProcessLaunchPlaceholders,
} from '@/project/process/launch_level/game_process_launch_placeholders.js';

/**
 * Parses a generated project file whose preview starts the game with the given
 * arguments.
 *
 * @param previewArguments Arguments of the preview section.
 * @returns Parsed project.
 */
function definitionCreate(previewArguments: string[]): ProjectDefinition {
  const projectFile = '/games/Ein Spiel/broom.project.json';
  const project = {
    project_id: 'placeholder-game',
    asset_root: 'assets',
    level_directory: 'broom/levels',
    document_directory: 'broom/documents',
    preview: { program: 'game', arguments: previewArguments, endpoint: 'http://127.0.0.1:15702' },
  };
  return ProjectDefinitionParser.parse(JSON.stringify(project), projectFile);
}

/**
 * The launch placeholders put the open level into the game's arguments: each
 * known placeholder is replaced by its value, unknown ones are found, and
 * arguments without placeholders stay unchanged.
 */
describe('GameProcessLaunchPlaceholders', () => {
  it('replaces each known placeholder with the value of the level', () => {
    const definition = definitionCreate(['--level', '{level_id}', '{level_document}', 'out={level_export_directory}']);
    const values = GameProcessLaunchPlaceholders.valuesCreate(definition, {
      levelId: 'Super Market',
      levelDocument: 'shops/super market.json',
    });
    const launch = definition.launch;
    if (launch === null) throw new Error('expected a preview section');
    const resolved = GameProcessLaunchPlaceholders.commandResolve(launch, values);
    expect(resolved.arguments).toEqual([
      '--level',
      'super_market',
      `${definition.documentDirectory}/shops/super market.json`,
      `out=${definition.levelDirectory}/super_market`,
    ]);
    expect(resolved.program).toBe(launch.program);
    expect(launch.arguments[1]).toBe('{level_id}');
  });

  it('gives every known placeholder a value', () => {
    const values = GameProcessLaunchPlaceholders.valuesCreate(definitionCreate([]), {
      levelId: 'lobby',
      levelDocument: 'lobby.json',
    });
    expect(Array.from(values.keys()).sort()).toEqual([...GAME_PROCESS_LAUNCH_PLACEHOLDER_NAMES].sort());
  });

  it('finds unknown placeholders and leaves them as written', () => {
    const argumentList = ['{level_id}', '{level_name}', '--x={camera}'];
    expect(GameProcessLaunchPlaceholders.unknownNamesRead(argumentList)).toEqual(['level_name', 'camera']);
    const values = new Map([['level_id', 'lobby']]);
    const command = { program: 'game', arguments: argumentList, workingDirectory: '/', endpoint: '' };
    expect(GameProcessLaunchPlaceholders.commandResolve(command, values).arguments).toEqual([
      'lobby',
      '{level_name}',
      '--x={camera}',
    ]);
  });

  it('needs a level only when a known placeholder is used', () => {
    expect(GameProcessLaunchPlaceholders.isLevelNeeded(definitionCreate(['run', '--release']).launch)).toBe(false);
    expect(GameProcessLaunchPlaceholders.isLevelNeeded(definitionCreate(['{camera}']).launch)).toBe(false);
    expect(GameProcessLaunchPlaceholders.isLevelNeeded(definitionCreate(['--level={level_id}']).launch)).toBe(true);
    expect(GameProcessLaunchPlaceholders.isLevelNeeded(null)).toBe(false);
  });

  it('needs the built package only for the id and the export directory', () => {
    expect(GameProcessLaunchPlaceholders.isLevelExportNeeded(definitionCreate(['{level_document}']).launch)).toBe(
      false,
    );
    expect(GameProcessLaunchPlaceholders.isLevelExportNeeded(definitionCreate(['{level_id}']).launch)).toBe(true);
    const exportLaunch = definitionCreate(['--dir={level_export_directory}']).launch;
    expect(GameProcessLaunchPlaceholders.isLevelExportNeeded(exportLaunch)).toBe(true);
  });
});
