import { tool, type McpToolDefinition } from './registry_mcp_tool_helpers.js';

/** Vertex list of a displacement grid, row by row. */
const displacementVertexListSchema = {
  type: 'array',
  items: { type: 'number' },
  description: '(2^power+1)^2 numbers, row by row from the face corner 0.',
};

/** List of brush faces a displacement tool names. */
const displacementFaceListSchema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      brushId: { type: 'string', description: 'Brush id owning the face.' },
      faceIndex: { type: 'integer', description: 'Brush face index.' },
    },
    required: ['brushId', 'faceIndex'],
  },
};

/** Tools that create, edit, sew and remove displacements of brush faces. */
export const MCP_DISPLACEMENT_TOOL_DEFINITIONS: McpToolDefinition[] = [
  tool(
    'set_face_displacement',
    'Create, edit or remove the displacement (sculpted heightfield) of one four-sided brush face as one undo step. create replaces the face with a flat grid of (2^power+1)^2 vertices (power 2, 3 or 4, default 3). set changes elevation, scale, offsets, alphas or collision flags of an existing displacement. destroy makes the face flat again. A vertex sits at its grid point plus the face normal times (elevation + offset * scale) meters. flags sets the game collision flags (noPhysicsCollision, noHullCollision, noRayCollision, seals; unnamed flags keep their value, new displacements start with all off). Returns { brushId, faceIndex, displaced, power, vertexCount, flags }.',
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
        flags: {
          type: 'object',
          description: 'Collision flags the game gives the surface; name only the flags to change.',
          properties: {
            noPhysicsCollision: { type: 'boolean', description: 'No physics collision.' },
            noHullCollision: { type: 'boolean', description: 'Does not block hulls (players, NPCs).' },
            noRayCollision: { type: 'boolean', description: 'Does not block ray traces.' },
            seals: { type: 'boolean', description: 'Seals the level against leaks.' },
          },
        },
      },
      required: ['brushId', 'faceIndex', 'action'],
    },
  ),
  tool(
    'select_adjacent_displacements',
    "Adds to the editor's face selection every displaced face (any brush, any solid model) whose border shares a world-space point with a selected displaced face, like the Displacement tab's Select Adjacent. faces, when given, first replaces the face selection with those brush faces. Returns { addedCount, faces: [{ brushId, faceIndex, displaced }] } listing the whole face selection afterwards.",
    {
      type: 'object',
      properties: {
        faces: { ...displacementFaceListSchema, description: 'Brush faces to select before adding the adjacent ones.' },
      },
    },
  ),
  tool(
    'sew_displacements',
    "Sews the shared edges of the named displaced faces (any brush, any solid model) as one undo step, like the Displacement tab's Sew: border vertices of different faces that share a flat world-space point move exactly onto their averaged displaced position, also when the faces have different normals. Faces without a displacement are ignored. Returns { sewnCount } counting the faces that changed.",
    {
      type: 'object',
      properties: {
        faces: { ...displacementFaceListSchema, description: 'Displaced brush faces to sew together.' },
      },
      required: ['faces'],
    },
  ),
];
