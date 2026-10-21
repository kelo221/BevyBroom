import { emptySchema, tool, type McpToolDefinition } from './registry_mcp_tool_helpers.js';

/** Tools that copy the selection as clipboard text and paste clipboard text. */
export const MCP_CLIPBOARD_TOOL_DEFINITIONS: McpToolDefinition[] = [
  tool(
    'copy_selection',
    'Copy the selected objects (brushes, CSG groups, solid models, lights, rooms, portals, game entities, groups) as clipboard text like Ctrl+C. Returns { text, count }; pass text to paste_objects. Does not change the scene.',
    emptySchema(),
  ),
  tool(
    'paste_objects',
    'Paste clipboard text from copy_selection like Ctrl+V as one undo step. Pasted objects get new ids, join the current layer and become the selection; brushes join the active solid model (a "World" model is created when none exists). Returns { ids } (object uuids, brush ids or group uuids). Text that holds no BevyBroom objects is rejected.',
    {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Clipboard text; the text copied last is used when omitted.' },
        atOriginalPosition: {
          type: 'boolean',
          description: 'Paste at the copied position (Ctrl+Alt+V) instead of under the mouse pointer. Default false.',
        },
      },
    },
  ),
];
