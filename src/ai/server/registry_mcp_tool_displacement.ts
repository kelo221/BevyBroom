import { tool, type McpToolDefinition } from './registry_mcp_tool_helpers.js';

/** Vertex list of a displacement grid, row by row. */
const displacementVertexListSchema = {
  type: 'array',
  items: { type: 'number' },
  description: '(2^power+1)^2 numbers, row by row from the face corner 0.',
};

/** Tools that create, edit and remove displacements of brush faces. */
export const MCP_DISPLACEMENT_TOOL_DEFINITIONS: McpToolDefinition[] = [
  tool(
    'set_face_displacement',
    'Create, edit or remove the displacement (sculpted heightfield) of one four-sided brush face as one undo step. create replaces the face with a flat grid of (2^power+1)^2 vertices (power 2, 3 or 4, default 3). set changes elevation, scale, offsets or alphas of an existing displacement. destroy makes the face flat again. A vertex sits at its grid point plus the face normal times (elevation + offset * scale) meters. Returns { brushId, faceIndex, displaced, power, vertexCount }.',
    {
      type: 'object',
      properties: {
        brushId: { type: 'string', description: 'Brush id owning the face.' },
        faceIndex: { type: 'integer', description: 'Brush face index (see get_face_uv).' },
        action: { type: 'string', enum: ['create', 'set', 'destroy'] },
        power: { type: 'integer', enum: [2, 3, 4] },
        elevation: { type: 'number', description: 'Meters the whole surface sits above the face.' },
        scale: { type: 'number', description: 'Multiplier applied to every offset.' },
        offsets: displacementVertexListSchema,
        alphas: { ...displacementVertexListSchema, description: 'Blend alphas 0..255, same layout as offsets.' },
      },
      required: ['brushId', 'faceIndex', 'action'],
    },
  ),
];
