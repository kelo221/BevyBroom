import { emptySchema, tool, type McpToolDefinition } from './registry_mcp_tool_helpers.js';

/** Tools that read the texture browser. */
export const MCP_TEXTURE_TOOL_DEFINITIONS: McpToolDefinition[] = [
  tool(
    'texture_browser_entries',
    "Every texture the Texture Browser lists, in browser order: the built-in checker, then Game materials (the connected game's catalog), then Project textures (images of the open project's texture_directories, id = path relative to the asset root), then the local folder. Returns { entries: [{ id, displayName, source }] }; use id as textureId of set_face_material.",
    emptySchema(),
  ),
];
