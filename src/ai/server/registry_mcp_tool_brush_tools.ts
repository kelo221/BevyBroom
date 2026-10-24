import { tool, type McpToolDefinition } from './registry_mcp_tool_helpers.js';

/** Brush id list shared by every brush editing tool. */
const brushIdsProperty = {
  type: 'array',
  items: { type: 'string' },
  description: 'Brush ids to edit; the selected brushes when omitted.',
};

/** World axis names. */
const axisProperty = { type: 'string', enum: ['x', 'y', 'z'] };

/**
 * Tools that edit the geometry of solid brushes like the Edit menu brush
 * commands.
 */
export const MCP_BRUSH_TOOL_DEFINITIONS: McpToolDefinition[] = [
  tool(
    'hollow_brushes',
    'Replace each brush with grouped walls (one per face) as thick as thickness (default: grid size) as one undo step. Brushes thinner than twice the thickness are left unchanged. Returns { wallBrushIds, count }. The walls become the selection.',
    {
      type: 'object',
      properties: {
        brushIds: brushIdsProperty,
        thickness: { type: 'number', description: 'Wall thickness in meters (default: grid size).' },
      },
    },
  ),
  tool(
    'convex_merge_brushes',
    'Replace two or more brushes of one solid model with the single convex brush around all their corners as one undo step; faces keep the closest source texture. Returns { brushId }. The merged brush becomes the selection.',
    { type: 'object', properties: { brushIds: brushIdsProperty } },
  ),
  tool(
    'flip_brushes',
    'Mirror brush geometry across the grid-snapped center of the brushes bounds along a world axis as one undo step. Textures stay locked when lockTextures is true (default). Returns { brushIds, axis, center }.',
    {
      type: 'object',
      properties: {
        brushIds: brushIdsProperty,
        axis: axisProperty,
        lockTextures: { type: 'boolean', description: 'Keep textures glued to the faces (default true).' },
      },
      required: ['axis'],
    },
  ),
  tool(
    'shear_brushes',
    'Shear brush geometry as one undo step: the side of the brushes bounds at the positive end of axis slides by offset along along while the opposite side stays fixed. Returns { brushIds, skippedBrushIds }.',
    {
      type: 'object',
      properties: {
        brushIds: brushIdsProperty,
        axis: axisProperty,
        along: axisProperty,
        offset: { type: 'number', description: 'Slide distance in meters.' },
        lockTextures: { type: 'boolean', description: 'Keep textures glued to the faces (default true).' },
      },
      required: ['axis', 'along', 'offset'],
    },
  ),
  tool(
    'snap_brush_vertices',
    'Round every vertex of the brushes to the grid size (step "grid", default) or to whole meters (step "integer") as one undo step. Brushes that would collapse are left unchanged. Returns { brushIds, skippedBrushIds }.',
    {
      type: 'object',
      properties: {
        brushIds: brushIdsProperty,
        step: { type: 'string', enum: ['grid', 'integer'] },
      },
    },
  ),
];
