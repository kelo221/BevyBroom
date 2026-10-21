import { tool, vec3Schema, type McpToolDefinition } from './registry_mcp_tool_helpers.js';

/** JSON Schema of the view a viewport input tool drives. */
const VIEWPORT_INPUT_VIEW_SCHEMA = {
  type: 'string',
  enum: ['perspective', 'top', 'front', 'side'],
  description: 'Visible view that receives the mouse input.',
};

/** JSON Schema of the modifier keys held during a viewport input gesture. */
const VIEWPORT_INPUT_KEYS_SCHEMA = {
  type: 'object',
  description: 'Modifier keys held for the whole gesture (all default false).',
  properties: {
    ctrl: { type: 'boolean' },
    shift: { type: 'boolean' },
    alt: { type: 'boolean' },
  },
};

/**
 * Tools that drive the mouse in an editor view with real pointer events, so
 * clicks and drags behave exactly like a user's mouse.
 */
export const MCP_VIEWPORT_INPUT_TOOL_DEFINITIONS: McpToolDefinition[] = [
  tool(
    'viewport_drag',
    'Left-button drag in a view from the world point `from` to `to` (projected through that view camera) like a user mouse drag: dragging a selected object moves the selection (Alt: vertically in perspective, Ctrl: duplicate first, Shift: no snap); dragging while nothing is selected draws a new box brush (Shift: square / equal sides, Alt: height in perspective). Visible gizmo handles win: a press on the resize arrow at a visible face center of the selection bounds (or on its outline in 2D views) resizes, so to move a box press on a visible face away from its center and edges. Returns `selection` like get_selection.',
    {
      type: 'object',
      properties: {
        view: VIEWPORT_INPUT_VIEW_SCHEMA,
        from: { ...vec3Schema, description: 'World point where the button is pressed.' },
        to: { ...vec3Schema, description: 'World point where the button is released.' },
        keys: VIEWPORT_INPUT_KEYS_SCHEMA,
        steps: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          description: 'Pointer moves between press and release (default 8).',
        },
      },
      required: ['view', 'from', 'to'],
    },
  ),
  tool(
    'viewport_click',
    'Left-button click in a view at the world point `at` (projected through that view camera) like a user mouse click: selects what is under the point (Shift adds, Ctrl toggles, empty space deselects). Returns `selection` like get_selection.',
    {
      type: 'object',
      properties: {
        view: VIEWPORT_INPUT_VIEW_SCHEMA,
        at: { ...vec3Schema, description: 'World point that is clicked.' },
        keys: VIEWPORT_INPUT_KEYS_SCHEMA,
      },
      required: ['view', 'at'],
    },
  ),
];
