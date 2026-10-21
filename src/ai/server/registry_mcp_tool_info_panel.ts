import { emptySchema, tool, type McpToolDefinition } from './registry_mcp_tool_helpers.js';

/**
 * Tools that read the editor's bottom info panel: the console messages and the
 * issues found in the open map.
 */
export const MCP_INFO_PANEL_TOOL_DEFINITIONS: McpToolDefinition[] = [
  tool(
    'console_read',
    'Recent editor console lines, oldest first, each with level (info, warning or error), ISO time and text. The console collects status bar messages, errors and game preview connection changes.',
    {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Most lines returned (newest kept). Default 100, at most 1000.' },
      },
    },
  ),
  tool(
    'issues_list',
    'Validate the open map now and list its issues: invalid brushes, empty or inverted solid models, subtractive brushes that cut nothing and game components of classes the game does not know. Each issue has id, severity, objectId, objectName, description and provider.',
    emptySchema(),
  ),
];
