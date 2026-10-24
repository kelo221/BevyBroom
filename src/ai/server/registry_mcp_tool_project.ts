import { emptySchema, tool, type McpToolDefinition } from './registry_mcp_tool_helpers.js';

/** Note added to every tool that needs the desktop app. */
const MCP_PROJECT_DESKTOP_NOTE = 'Desktop app only; the browser editor reports that it cannot manage games.';

/**
 * Tools that open a game project and launch, rebuild, restart and stop the game
 * this editor manages.
 */
export const MCP_PROJECT_TOOL_DEFINITIONS: McpToolDefinition[] = [
  tool(
    'project_open',
    `Open a game project (broom.project.json). Stops the game of the previous project, links an unlinked document to the project and points the game preview at its endpoint. ${MCP_PROJECT_DESKTOP_NOTE}`,
    {
      type: 'object',
      properties: { path: { type: 'string', description: 'Absolute path of broom.project.json.' } },
      required: ['path'],
    },
  ),
  tool(
    'project_status',
    'The open project, the game phase (idle, building, build_failed, starting, running, exited, stopping, stopped), its process id, the compiler messages of the last build, the newest output lines, and which project the document and the connected game must belong to.',
    emptySchema(),
  ),
  tool(
    'game_launch',
    `Build the game when the project can be built, then start it and connect the preview. Returns at once; poll project_status. ${MCP_PROJECT_DESKTOP_NOTE}`,
    emptySchema(),
  ),
  tool(
    'game_rebuild',
    `Stop the game, build it again and start it. Returns at once; poll project_status. ${MCP_PROJECT_DESKTOP_NOTE}`,
    emptySchema(),
  ),
  tool(
    'game_restart',
    `Stop the game and start it again without building. Returns at once; poll project_status. ${MCP_PROJECT_DESKTOP_NOTE}`,
    emptySchema(),
  ),
  tool(
    'game_stop',
    `Stop the game this editor started. A game started any other way is never stopped. ${MCP_PROJECT_DESKTOP_NOTE}`,
    emptySchema(),
  ),
  tool(
    'build_level',
    `Build the open document into a level package of the open project: errors in the Issues list stop the build, then the geometry GLB and a version 2 level.broom.json (authored state and material ids) are written into the project's level directory. The manifest is replaced in one step, so an interrupted build keeps the previous package loadable. The game loads it without the editor (broom_preview --level <levelName>). Returns { levelName, levelDirectory, geometryFile, geometryRevision, objectCount, materials, removedGeometryFiles }, or the problems that stopped it. ${MCP_PROJECT_DESKTOP_NOTE}`,
    {
      type: 'object',
      properties: {
        levelName: { type: 'string', description: 'Level name; defaults to the name derived from the scene file.' },
      },
    },
  ),
];
