import { emptySchema, tool, vec3Schema, type McpToolDefinition } from './registry_mcp_tool_helpers.js';

const FIELD_VALUES_DESCRIPTION =
  'Field path to value, in the normalized form: numbers, booleans and strings as is, vectors as arrays, colors as sRGB [r,g,b,a] arrays, enums as the variant name, asset fields as the asset path (null for none), property maps as objects of string, number or boolean.';

/**
 * Tools that list the game's component classes, place game entities, edit the
 * game components of any object and read and write the game's data asset
 * files.
 */
export const MCP_GAME_ENTITY_TOOL_DEFINITIONS: McpToolDefinition[] = [
  tool(
    'list_game_classes',
    'The game component classes the editor knows (from the running game, the scene or built in) with their fields, kinds and defaults, and the asset types asset fields may reference with their files.',
    emptySchema(),
  ),
  tool(
    'add_game_entity',
    'Add an empty game entity point, optionally carrying one game component class with field overrides (undoable). Returns its id.',
    {
      type: 'object',
      properties: {
        class: { type: 'string', description: 'Component type path from list_game_classes. Omit for an empty entity.' },
        name: { type: 'string', description: 'Outliner name. Defaults to the class label.' },
        position: { ...vec3Schema, description: 'World position in meters (right-handed, Y up).' },
        rotationDegrees: { ...vec3Schema, description: 'Euler rotation in degrees (XYZ order).' },
        fields: { type: 'object', description: `Overrides of the class. ${FIELD_VALUES_DESCRIPTION}` },
      },
    },
  ),
  tool(
    'set_game_components',
    'Set, add or remove game components of any object: brushes, solids, groups, lights, rooms, portals or game entities (undoable). Listed components are attached when missing; fields equal to the default drop their override.',
    {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Object id (uuid).' },
        components: {
          type: 'object',
          description: `Component type path to field values, or null to remove that component. ${FIELD_VALUES_DESCRIPTION}`,
        },
      },
      required: ['id', 'components'],
    },
  ),
  tool(
    'read_data_asset',
    'Read a data asset file of the running game: its type and the fields it overrides, with the type fields and defaults.',
    {
      type: 'object',
      properties: { path: { type: 'string', description: 'Asset path under the game asset root.' } },
      required: ['path'],
    },
  ),
  tool(
    'write_data_asset',
    'Replace or create a data asset file of the running game with field overrides; the game reloads it. Not undoable.',
    {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Asset path under the game asset root, ending in the type extension.' },
        typePath: {
          type: 'string',
          description: 'Asset type path. Defaults to the type whose extension the path has.',
        },
        values: {
          type: 'object',
          description: `Fields that differ from the type default. ${FIELD_VALUES_DESCRIPTION}`,
        },
      },
      required: ['path', 'values'],
    },
  ),
];
