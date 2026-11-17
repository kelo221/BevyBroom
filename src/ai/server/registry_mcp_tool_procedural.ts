import { emptySchema, tool, vec3Schema, type McpToolDefinition } from './registry_mcp_tool_helpers.js';

/** Description of the settings object of a procedural object. */
const PROCEDURAL_SETTINGS_DESCRIPTION =
  'Procedural settings: generatorId (from list_procedural_generators, default "box"), parameters (field path → value; points are [x, y, z] in the object\'s local meters) and materials (material slot → texture id). Fields left out keep their current or default value.';

/** Tools that list procedural generators and add and edit procedural objects. */
export const MCP_PROCEDURAL_TOOL_DEFINITIONS: McpToolDefinition[] = [
  tool(
    'list_procedural_generators',
    'The procedural generators the editor knows, with their fields, defaults, point handles (handlePoints), box face handles (handleFaces, such as max_y) and material slots.',
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
  tool(
    'get_entity_handles',
    'Read-only: the handles of an entity (procedural object, light, ...) as a view shows them once the entity is selected. Each handle has its `name`, the world `position` of its ball and the `arrows` the view lets the user grab, each with its world `direction` and the world `tip` of the arrow in that view (arrows pointing into the view are left out). Press on the ball or between the ball and an arrow tip with viewport_drag to drag the handle like a user; an arrow drag moves the handle only along its direction. Procedural boxes show one handle per face with an arrow along the face normal; points such as escalator ends show X, Y and Z arrows.',
    {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Entity id (object uuid), such as the id add_procedural returns.' },
        view: {
          type: 'string',
          enum: ['perspective', 'top', 'front', 'side'],
          description: 'View the handles are read in.',
        },
      },
      required: ['id', 'view'],
    },
  ),
];
