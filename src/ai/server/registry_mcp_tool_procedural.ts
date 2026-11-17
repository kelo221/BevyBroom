import { emptySchema, tool, vec3Schema, type McpToolDefinition } from './registry_mcp_tool_helpers.js';

/** Description of the settings object of a procedural object. */
const PROCEDURAL_SETTINGS_DESCRIPTION =
  'Procedural settings: generatorId (from list_procedural_generators, default "box"), parameters (field path → value; points are [x, y, z] in the object\'s local meters) and materials (material slot → texture id). Fields left out keep their current or default value.';

/** Tools that list procedural generators and add and edit procedural objects. */
export const MCP_PROCEDURAL_TOOL_DEFINITIONS: McpToolDefinition[] = [
  tool(
    'list_procedural_generators',
    'The procedural generators the editor knows, with their fields, defaults, point handles and material slots.',
    emptySchema(),
  ),
  tool(
    'add_procedural',
    'Add a procedural object whose mesh a generator builds from its parameters (undoable). Returns its id and settings.',
    {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Outliner name. Defaults to the generator label.' },
        position: { ...vec3Schema, description: 'World position in meters (right-handed, Y up).' },
        rotationDegrees: { ...vec3Schema, description: 'Euler rotation in degrees (XYZ order).' },
        settings: { type: 'object', description: PROCEDURAL_SETTINGS_DESCRIPTION },
      },
    },
  ),
  tool('set_procedural_settings', 'Change the parameters or textures of a procedural object (undoable).', {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Id returned by add_procedural (the object uuid).' },
      settings: { type: 'object', description: PROCEDURAL_SETTINGS_DESCRIPTION },
    },
    required: ['id', 'settings'],
  }),
];
