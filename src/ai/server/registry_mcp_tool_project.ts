import { emptySchema, tool, type McpToolDefinition } from './registry_mcp_tool_helpers.js';

/** Note added to every tool that needs the desktop app. */
const MCP_PROJECT_DESKTOP_NOTE = 'Desktop app only; the browser editor reports that it cannot manage games.';

/**
 * Tools that open a game project, launch, rebuild, restart and stop the game
 * this editor manages, and list, open and save the project's levels.
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
  tool(
    'list_project_levels',
    `List the levels of the open project: the entries of its broom.project.json "levels" list first, then every other scene document found in its document_directory. Returns { projectFile, documentDirectory, levels: [{ id, name, document, modifiedMilliseconds, isListed }], openLevel } where openLevel names the level the open scene was loaded from or last saved to, or null. ${MCP_PROJECT_DESKTOP_NOTE}`,
    emptySchema(),
  ),
  tool(
    'open_project_level',
    `Replace the open scene with a level document of the open project, found by levelId or document path, and remember it so save_project_level and File > Save write back to it. Unsaved work is replaced without asking. ${MCP_PROJECT_DESKTOP_NOTE}`,
    {
      type: 'object',
      properties: {
        levelId: { type: 'string', description: 'Level id as listed by list_project_levels.' },
        document: {
          type: 'string',
          description: 'Document path relative to the document directory, such as "castle_hall.json".',
        },
      },
    },
  ),
  tool(
    'save_project_level',
    `Save the open scene into the open project. Without a name it writes back into the open level and fails when none is open or another program changed the document since; with a name it creates a new level document named after the name and makes it the open level. Returns the level { id, name, document, modifiedMilliseconds, isListed }. ${MCP_PROJECT_DESKTOP_NOTE}`,
    {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Display name of a new level; omit to write back into the open level.' },
      },
    },
  ),
];
