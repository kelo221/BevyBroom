import { describe, expect, it } from 'vitest';
import { RunConfigurationParser } from '@/project/run_configuration/model/run_configuration_parser.js';
import { RUN_CONFIGURATIONS_PROJECT_KEY } from '@/project/run_configuration/model/run_configuration_types.js';

/**
 * The parser reads run configurations from the project file form and writes
 * them back in the same form, refusing malformed lists.
 */
describe('RunConfigurationParser', () => {
  it('reads steps with their kind, skip flag and fields', () => {
    const configurations = RunConfigurationParser.projectRead({
      [RUN_CONFIGURATIONS_PROJECT_KEY]: [
        {
          id: 'bake',
          name: 'Bake Lighting',
          steps: [{ kind: 'level_save' }, { kind: 'command', enabled: false, program: 'cargo', arguments: ['run'] }],
        },
      ],
    });
    expect(configurations).toEqual([
      {
        id: 'bake',
        name: 'Bake Lighting',
        steps: [
          { kind: 'level_save', enabled: true, fields: {} },
          { kind: 'command', enabled: false, fields: { program: 'cargo', arguments: ['run'] } },
        ],
      },
    ]);
  });

  it('writes configurations that read back unchanged', () => {
    const configurations = [
      { id: 'play', name: 'Play', steps: [{ kind: 'game_play', enabled: false, fields: { note: ['a', 'b'] } }] },
    ];
    const written = RunConfigurationParser.listWrite(configurations);
    expect(written[0]?.['steps']).toEqual([{ kind: 'game_play', enabled: false, note: ['a', 'b'] }]);
    expect(RunConfigurationParser.listRead(written)).toEqual(configurations);
  });

  it('reads no configurations when the project has none', () => {
    expect(RunConfigurationParser.projectRead({})).toEqual([]);
  });

  it('refuses malformed lists, steps and repeated ids', () => {
    expect(() => RunConfigurationParser.listRead({})).toThrow();
    expect(() => RunConfigurationParser.listRead([{ id: 'a', name: '', steps: [] }])).toThrow();
    expect(() => RunConfigurationParser.listRead([{ id: 'a', name: 'A', steps: [{ kind: 'x', count: 3 }] }])).toThrow();
    expect(() =>
      RunConfigurationParser.listRead([{ id: 'a', name: 'A', steps: [{ kind: 'x', enabled: 'no' }] }]),
    ).toThrow();
    const repeated = { id: 'a', name: 'A', steps: [] };
    expect(() => RunConfigurationParser.listRead([repeated, repeated])).toThrow(/used twice/);
  });
});
