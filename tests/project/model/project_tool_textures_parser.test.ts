import { describe, expect, it } from 'vitest';
import { ProjectDefinitionParser } from '@/project/model/project_definition_parser.js';
import { ProjectToolTexturesParser } from '@/project/model/project_tool_textures_parser.js';

/** Projects mark tool textures once, in the project file. */
describe('ProjectToolTexturesParser', () => {
  it('reads the nodraw texture ids sorted and without repeats or blanks', () => {
    expect(
      ProjectToolTexturesParser.read({
        tool_textures: { nodraw: ['tools/nodraw.png', ' ', 'a/clip.png', 'tools/nodraw.png', 4] },
      }),
    ).toEqual({ nodraw: ['a/clip.png', 'tools/nodraw.png'] });
  });

  it('reads a missing or malformed field as no tool textures', () => {
    expect(ProjectToolTexturesParser.read({})).toEqual({ nodraw: [] });
    expect(ProjectToolTexturesParser.read({ tool_textures: ['nodraw'] })).toEqual({ nodraw: [] });
    expect(ProjectToolTexturesParser.read({ tool_textures: { nodraw: 'x' } })).toEqual({ nodraw: [] });
  });

  it('is part of the parsed project', () => {
    const project = {
      project_version: 1,
      project_id: 'p',
      asset_root: 'assets',
      level_directory: 'levels',
      tool_textures: { nodraw: ['textures/NODRAW.png'] },
    };
    expect(ProjectDefinitionParser.parse(JSON.stringify(project), '/game/broom.project.json').toolTextures).toEqual({
      nodraw: ['textures/NODRAW.png'],
    });
  });
});
