import { emptySchema, tool, type McpToolDefinition } from './registry_mcp_tool_helpers.js';

/** JSON Schema of a layer identifier argument. */
const LAYER_ID_SCHEMA = { type: 'string', description: 'Layer id from list_layers.' };

/**
 * Tools that list and edit TrenchBroom-style layers: named sets of top-level
 * objects that can be hidden, locked or left out of exports.
 */
export const MCP_LAYER_TOOL_DEFINITIONS: McpToolDefinition[] = [
  tool(
    'list_layers',
    'The layers in display order (the default layer first) with their switches, whether each is current, and the ids of their top-level objects.',
    emptySchema(),
  ),
  tool('create_layer', 'Add a layer at the end of the list (undoable). Returns its id.', {
    type: 'object',
    properties: { name: { type: 'string', description: 'Layer name. Defaults to "Layer N".' } },
  }),
  tool('remove_layer', 'Remove a layer other than the default; its objects move to the default layer (undoable).', {
    type: 'object',
    properties: { id: LAYER_ID_SCHEMA },
    required: ['id'],
  }),
  tool('rename_layer', 'Rename a layer other than the default (undoable).', {
    type: 'object',
    properties: { id: LAYER_ID_SCHEMA, name: { type: 'string', description: 'New non-blank name.' } },
    required: ['id', 'name'],
  }),
  tool('set_current_layer', 'Make a layer current: objects created afterwards join it. Not undoable.', {
    type: 'object',
    properties: { id: LAYER_ID_SCHEMA },
    required: ['id'],
  }),
  tool(
    'set_layer_flags',
    'Set switches of a layer as one undoable edit. hidden: not drawn or pickable in the editor and hidden in the game preview. locked: not selectable or editable. omitFromExport: left out of exported files and the game preview.',
    {
      type: 'object',
      properties: {
        id: LAYER_ID_SCHEMA,
        hidden: { type: 'boolean' },
        locked: { type: 'boolean' },
        omitFromExport: { type: 'boolean' },
      },
      required: ['id'],
    },
  ),
  tool(
    'move_objects_to_layer',
    'Move objects into a layer (undoable). Nested objects move with their top-level ancestor.',
    {
      type: 'object',
      properties: {
        ids: { type: 'array', items: { type: 'string' }, description: 'Object ids (uuid).' },
        layerId: LAYER_ID_SCHEMA,
      },
      required: ['ids', 'layerId'],
    },
  ),
];
