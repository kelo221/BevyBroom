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
    `Build the game when the project can be built, then start it and connect the preview. When the project's preview arguments name {level_id}, {level_document} or {level_export_directory}, the open project level is built first (from the scene as it is now) and the game starts in it; launchLevelId tells which. Returns at once; poll project_status. ${MCP_PROJECT_DESKTOP_NOTE}`,
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
    'game_play_level',
    `Play the open level in the game now, as Run > Play Level in Game (F9) does: when the game starts in the open level, save and build it first, then start the game, or build and start it again when it already runs (restart when it cannot be built). Returns at once; poll project_status. ${MCP_PROJECT_DESKTOP_NOTE}`,
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
  tool(
    'list_project_classes',
    `The game entity classes declared in the open project's class file (broom.project.json "entity_classes"), shared by every level and shown without the game running. Returns { isConfigured, fileName, problem, classes, undeclaredLevelClasses } where undeclaredLevelClasses lists classes the open level carries in its own snapshot but the file lacks. A connected game's classes still win over the file. ${MCP_PROJECT_DESKTOP_NOTE}`,
    emptySchema(),
  ),
  tool(
    'set_project_class',
    `Declare a game entity class in the project's class file, replacing the class with the same type_path. Every level of the project shows it at once. Not undoable; the file is written right away. ${MCP_PROJECT_DESKTOP_NOTE}`,
    {
      type: 'object',
      properties: {
        class: {
          type: 'object',
          description:
            'Class in the bridge placeable format: { type_path, label, category, placement ("point" or "any"), marker_color [r,g,b] 0..1, fields: [{ path, label, kind, default, ... }] } as list_game_classes reports it.',
        },
      },
      required: ['class'],
    },
  ),
  tool(
    'remove_project_class',
    `Remove a class from the project's class file. Objects keep their component values; a level's own snapshot still describes the class. ${MCP_PROJECT_DESKTOP_NOTE}`,
    {
      type: 'object',
      properties: { typePath: { type: 'string', description: 'Component type path of the class.' } },
      required: ['typePath'],
    },
  ),
  tool(
    'move_level_classes_to_project',
    `Copy every class the open level carries in its own snapshot but the project's class file lacks into the file (File > Move Level Classes to Project). Classes the file already declares are kept as they are. Returns { moved }. ${MCP_PROJECT_DESKTOP_NOTE}`,
    emptySchema(),
  ),
  tool(
    'list_prefabs',
    "Every prefab, as the Entity Browser lists them under Prefabs: { prefabs: [{ id, name, category, objectCount, brushCount, isProjectFile }] }. isProjectFile is true for prefabs kept as files in the open project's prefab_directory.",
    emptySchema(),
  ),
  tool(
    'create_prefab',
    'Capture the selected objects and brushes, with their geometry, textures and game data, as a new prefab (undoable). While the open project names a prefab_directory the prefab is saved there as <id>.json; otherwise it lasts for the session. Returns its id.',
    {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Display name; the id derives from it.' },
        category: { type: 'string', description: 'Prefab category in the Entity Browser; "Prefabs" when omitted.' },
      },
      required: ['name'],
    },
  ),
  tool(
    'place_prefab',
    "Place a copy of a prefab (undoable). Placed objects are independent copies; changing the prefab later does not change them. Names the prefab's objects fire entity I/O at get a fresh suffix per copy. Returns the ids of the placed objects.",
    {
      type: 'object',
      properties: {
        prefabId: { type: 'string', description: 'Prefab id as listed by list_prefabs.' },
        position: {
          type: 'object',
          description:
            'World position for the bottom centre of the prefab bounds; omitted places it where it was captured.',
          properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } },
          required: ['x', 'y', 'z'],
        },
      },
      required: ['prefabId'],
    },
  ),
  tool(
    'update_prefab',
    "Rename a prefab or move it to another category (undoable), as the Entity Browser's Rename and Change Category do; a project prefab's file is saved again. Returns the prefab.",
    {
      type: 'object',
      properties: {
        prefabId: { type: 'string', description: 'Prefab id as listed by list_prefabs; it stays the same.' },
        name: { type: 'string', description: 'New display name; unchanged when omitted.' },
        category: { type: 'string', description: 'New category; unchanged when omitted.' },
      },
      required: ['prefabId'],
    },
  ),
  tool(
    'delete_prefab',
    "Delete a prefab (undoable); a project prefab's file is deleted too and written again on undo.",
    {
      type: 'object',
      properties: { prefabId: { type: 'string', description: 'Prefab id as listed by list_prefabs.' } },
      required: ['prefabId'],
    },
  ),
];
