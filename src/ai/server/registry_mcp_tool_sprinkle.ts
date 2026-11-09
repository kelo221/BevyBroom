import { SPRINKLE_PLACEMENT_MODES, SPRINKLE_RADIUS_MAX, SPRINKLE_RADIUS_MIN } from '@/tools/sprinkle/sprinkle_types.js';
import { emptySchema, tool, vec3Schema, type McpToolDefinition } from './registry_mcp_tool_helpers.js';

/** Tools that list sprinkle types and paint with the Entity Sprinkle tool. */
export const MCP_SPRINKLE_TOOL_DEFINITIONS: McpToolDefinition[] = [
  tool(
    'sprinkle_definitions_list',
    'Lists the sprinkle types (Entity Sprinkle definitions) loaded from the open project, in Type list order. Returns { definitions: [{ name, sourcePath, grid: { sizeU, sizeV } | null, caseCount }], problems } where problems lists definition files that failed to read.',
    emptySchema(),
  ),
  tool(
    'sprinkle_stamp',
    `Paints one complete Entity Sprinkle stroke (one undo step) at a world point, like one Hammer++ Sprinkle click. The grid is world-aligned on the axis plane most facing the normal (floors use X/Z, walls facing X use Z/Y, walls facing Z use X/Y); every grid cell whose center lies within radius of center (measured in that plane) is projected onto the surfaces below along the plane's axis and, with densityPercent chance, receives an entity of a weighted random case of the definition. Modes: ADDITIVE places and replaces the sprinkled entity a cell held, SUBTRACTIVE removes sprinkled entities in the radius, REPLACE removes them then places, OVERWRITE places only into cells that hold a sprinkled entity. Only entities created by the Sprinkle tool are ever removed. Omitted options come from the Entity Sprinkle window's configuration; radius is clamped to ${SPRINKLE_RADIUS_MIN}..${SPRINKLE_RADIUS_MAX} m. Returns { added, removed }.`,
    {
      type: 'object',
      properties: {
        definition: { type: 'string', description: 'Sprinkle type name (see sprinkle_definitions_list).' },
        center: { ...vec3Schema, description: 'World point on the surface the stroke is centered on.' },
        normal: { ...vec3Schema, description: 'Surface normal at center; default up (0, 1, 0).' },
        mode: { type: 'string', enum: [...SPRINKLE_PLACEMENT_MODES] },
        radius: { type: 'number', description: 'Brush radius in meters.' },
        densityPercent: { type: 'number', description: 'Chance 0..100 that a grid cell receives an entity.' },
        seed: { type: 'integer', description: 'Seed of the placement random stream; default the configured seed.' },
      },
      required: ['definition', 'center'],
    },
  ),
];
