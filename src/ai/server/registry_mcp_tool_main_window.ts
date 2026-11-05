import { emptySchema, tool, type McpToolDefinition } from './registry_mcp_tool_helpers.js';

/**
 * Tools that read and change which docks, tabs and bars of the main window are
 * shown, and open, apply and cancel its Object Properties dialog.
 */
export const MCP_MAIN_WINDOW_TOOL_DEFINITIONS: McpToolDefinition[] = [
  tool(
    'get_main_window',
    'The main window arrangement: inspectorVisible, infoPanelVisible and infoPanelTab (console or issues), toolbarVisible, and the menu bar titles in order.',
    emptySchema(),
  ),
  tool(
    'set_main_window',
    'Show or hide the inspector, info panel and toolbar, and switch the info panel tab. Omitted fields stay as they are. Returns the new arrangement like get_main_window.',
    {
      type: 'object',
      properties: {
        inspectorVisible: { type: 'boolean', description: 'Show or hide the inspector on the right.' },
        infoPanelTab: { type: 'string', enum: ['console', 'issues'], description: 'Info panel tab to show.' },
        infoPanelVisible: { type: 'boolean', description: 'Show or hide the info panel below the views.' },
        toolbarVisible: { type: 'boolean', description: 'Show or hide the icon toolbar.' },
      },
    },
  ),
  tool(
    'get_object_properties_dialog',
    'The Object Properties dialog: open, the visible tab, the tab ids in order (class_info, outputs, inputs, properties, visgroup, ...) and the ids of the objects it edits.',
    emptySchema(),
  ),
  tool(
    'set_object_properties_dialog',
    'Open the Object Properties dialog on the selection (like Alt+Enter), Apply its edits as one undo step or Cancel them, and switch its tab. Returns the state like get_object_properties_dialog.',
    {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['open', 'apply', 'cancel'],
          description:
            'open needs a selection; apply keeps the edits as one undo step; cancel restores the state from before opening.',
        },
        tab: { type: 'string', description: 'Tab id to show, from get_object_properties_dialog.' },
      },
    },
  ),
];
