import { emptySchema, tool, type McpToolDefinition } from './registry_mcp_tool_helpers.js';

/** Tools that read the face editing state of the editor. */
export const MCP_FACE_EDIT_TOOL_DEFINITIONS: McpToolDefinition[] = [
  tool(
    'get_face_edit_state',
    "Active tools palette tool (object, face, block, entity, stamp, clip_plane, vertex, polygon, sprinkle, grid), whether the Face Edit Sheet is open and its tab (material, displacement), and the editor's face selection. Returns { activeTool, faceEditSheetOpen, faceEditSheetTab, faces: [{ brushId, faceIndex, displaced }] }.",
    emptySchema(),
  ),
];
