import { MCP_LIGHT_SETTINGS_DESCRIPTION } from './registry_mcp_tool_light_settings.js';
import { emptySchema, tool, vec3Schema, type McpToolDefinition } from './registry_mcp_tool_helpers.js';

/**
 * Builds the input schema of an add_light / add_room / add_portal tool.
 *
 * @param settingsDescription Description of the kind's settings object.
 * @returns JSON Schema object.
 */
function entityAddSchema(settingsDescription: string): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Outliner name. Defaults to the kind name.' },
      position: { ...vec3Schema, description: 'World position in meters (right-handed, Y up).' },
      rotationDegrees: { ...vec3Schema, description: 'Euler rotation in degrees (XYZ order).' },
      scale: {
        ...vec3Schema,
        description: 'Scale; rooms and portals size with it. Lights ignore it: set settings.radius instead.',
      },
      settings: { type: 'object', description: settingsDescription },
    },
  };
}

/**
 * Builds the input schema of a set_*_settings tool.
 *
 * @param settingsDescription Description of the kind's settings object.
 * @returns JSON Schema object.
 */
function entitySettingsSetSchema(settingsDescription: string): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Id returned by the add tool (the object uuid).' },
      settings: { type: 'object', description: `${settingsDescription} Only the given fields change.` },
    },
    required: ['id', 'settings'],
  };
}

const ROOM_SETTINGS_DESCRIPTION =
  'Room settings: halfSizeX, halfSizeY, halfSizeZ in local meters. A room is a box cell for portal culling.';

const PORTAL_SETTINGS_DESCRIPTION =
  'Portal settings: width and height in local meters of the opening in the local XY plane (front faces +Z), closed (bool, a shut door).';

/**
 * Tools that add and edit lights, rooms and portals, drive the game preview and
 * read or load the scene document.
 */
export const MCP_ENTITY_TOOL_DEFINITIONS: McpToolDefinition[] = [
  tool(
    'add_light',
    'Add a light (undoable). Returns its id and settings.',
    entityAddSchema(MCP_LIGHT_SETTINGS_DESCRIPTION),
  ),
  tool(
    'set_light_settings',
    'Change settings of a light (undoable).',
    entitySettingsSetSchema(MCP_LIGHT_SETTINGS_DESCRIPTION),
  ),
  tool(
    'add_room',
    'Add a room cell for DynLight portal culling (undoable). Each doorway portal must sit on the shared wall of two rooms.',
    entityAddSchema(ROOM_SETTINGS_DESCRIPTION),
  ),
  tool(
    'set_room_settings',
    'Change the size of a room (undoable).',
    entitySettingsSetSchema(ROOM_SETTINGS_DESCRIPTION),
  ),
  tool(
    'add_portal',
    'Add a portal (doorway) between two rooms (undoable). Place it in the doorway plane.',
    entityAddSchema(PORTAL_SETTINGS_DESCRIPTION),
  ),
  tool(
    'set_portal_settings',
    'Change the size of a portal or open and close it (undoable).',
    entitySettingsSetSchema(PORTAL_SETTINGS_DESCRIPTION),
  ),
  tool('preview_connect', 'Connect the editor to a running game preview (broom bridge).', {
    type: 'object',
    properties: {
      endpoint: { type: 'string', description: 'Bridge URL, e.g. http://127.0.0.1:15702. Defaults to the last one.' },
    },
  }),
  tool(
    'preview_status',
    'Game preview link state, revisions sent, and the game status (shown revisions, lights, rooms, portals, culling state, bake state, errors).',
    emptySchema(),
  ),
  tool(
    'get_scene_document',
    'The open scene as scene file JSON text, exactly as Save writes it, with its document id.',
    emptySchema(),
  ),
  tool('load_scene_document', 'Replace the open scene with scene file JSON text, as Load does.', {
    type: 'object',
    properties: { json: { type: 'string', description: 'Scene file text from get_scene_document or a .json file.' } },
    required: ['json'],
  }),
];
