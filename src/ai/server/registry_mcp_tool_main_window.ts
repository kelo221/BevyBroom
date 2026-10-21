import { emptySchema, tool, type McpToolDefinition } from './registry_mcp_tool_helpers.js';

/**
 * Tools that read and change which docks, tabs and bars of the main window are
 * shown.
 */
export const MCP_MAIN_WINDOW_TOOL_DEFINITIONS: McpToolDefinition[] = [
  tool(
    'get_main_window',
    'The main window arrangement: inspectorVisible and inspectorTab (map, entity or face), infoPanelVisible and infoPanelTab (console or issues), toolbarVisible, and the menu bar titles in order.',
    emptySchema(),
  ),
  tool(
    'set_main_window',
    'Show or hide the inspector, info panel and toolbar, and switch the inspector or info panel tab. Omitted fields stay as they are. Returns the new arrangement like get_main_window.',
    {
      type: 'object',
      properties: {
        inspectorTab: { type: 'string', enum: ['map', 'entity', 'face'], description: 'Inspector tab to show.' },
        inspectorVisible: { type: 'boolean', description: 'Show or hide the inspector on the right.' },
        infoPanelTab: { type: 'string', enum: ['console', 'issues'], description: 'Info panel tab to show.' },
        infoPanelVisible: { type: 'boolean', description: 'Show or hide the info panel below the views.' },
        toolbarVisible: { type: 'boolean', description: 'Show or hide the icon toolbar.' },
      },
    },
  ),
];
