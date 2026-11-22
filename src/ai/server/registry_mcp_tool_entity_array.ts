import { tool, type McpToolDefinition } from './registry_mcp_tool_helpers.js';

/** Description of the array settings an entity repeats with. */
const ENTITY_ARRAY_SETTINGS_DESCRIPTION =
  'Array settings: count_x, count_y and count_z (whole numbers from 1, the entity itself included, along its own X, Y and Z axes) and gap ([x, y, z] meters left between neighbours, from 0). Copies stand one footprint (the box the entity fills, such as a fixture model box) plus one gap apart. Fields left out keep their current value. null stops repeating and removes the copies.';

/** Tools that make entities repeat and bake their copies. */
export const MCP_ENTITY_ARRAY_TOOL_DEFINITIONS: McpToolDefinition[] = [
  tool(
    'set_entity_array',
    'Make an entity (game entity such as a store fixture, light, procedural object, ...) repeat along its own axes, change how, or stop it (undoable). The copies are rebuilt whenever the entity changes, are sent to the game as ordinary entities and cannot be selected; edit the source instead. Returns the settings and the copy ids.',
    {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Id of the source entity (object uuid).' },
        array: { type: ['object', 'null'], description: ENTITY_ARRAY_SETTINGS_DESCRIPTION },
      },
      required: ['id', 'array'],
    },
  ),
  tool(
    'bake_entity_array',
    'Turn the copies of a repeating entity into ordinary entities beside it, each editable on its own, and stop the source repeating (undoable). Returns the ids of the baked entities.',
    {
      type: 'object',
      properties: { id: { type: 'string', description: 'Id of the source entity (object uuid).' } },
      required: ['id'],
    },
  ),
];
