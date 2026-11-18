import { describe, expect, it } from 'vitest';
import { LevelExportCliArgumentsParser } from '@/level_export/cli/level_export_cli_arguments.js';

/**
 * The command line takes a project, a level, an optional output and a check
 * switch.
 */
describe('LevelExportCliArgumentsParser', () => {
  it('reads every option in any order', () => {
    expect(
      LevelExportCliArgumentsParser.parse([
        '--check',
        '--level',
        'store',
        '--out',
        'build/store',
        '--project',
        'game/broom.project.json',
      ]),
    ).toEqual({ projectFile: 'game/broom.project.json', levelId: 'store', outDirectory: 'build/store', isCheck: true });
    expect(LevelExportCliArgumentsParser.parse(['--project', 'p.json', '--level', 'a'])).toEqual({
      projectFile: 'p.json',
      levelId: 'a',
      outDirectory: null,
      isCheck: false,
    });
  });

  it('refuses missing, valueless and unknown options with the usage', () => {
    expect(() => LevelExportCliArgumentsParser.parse(['--project', 'p.json'])).toThrow(/Usage/);
    expect(() => LevelExportCliArgumentsParser.parse(['--project', '--level', 'a'])).toThrow(/needs a value/);
    expect(() => LevelExportCliArgumentsParser.parse(['--project', 'p.json', '--level', 'a', '--fast', 'yes'])).toThrow(
      /Unknown option/,
    );
  });
});
