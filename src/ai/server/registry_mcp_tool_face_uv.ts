import { MCP_FACE_UV_OPERATION_NAMES } from '@/ai/shared/mcp_face_uv_operation_names.js';
import { tool, type McpToolDefinition } from './registry_mcp_tool_helpers.js';

/** Face selection shared by every face UV tool. */
const faceTargetProperties = {
  brushId: { type: 'string', description: 'Brush id owning the faces.' },
  faceIndices: {
    type: 'array',
    items: { type: 'integer' },
    description: 'Brush face indices (see get_face_uv); every face when omitted.',
  },
};

/** UV row of four numbers. */
const uvRowSchema = {
  type: 'array',
  items: { type: 'number' },
  minItems: 4,
  maxItems: 4,
};

/** Tools that read and edit the texture and UV mapping of brush faces. */
export const MCP_FACE_UV_TOOL_DEFINITIONS: McpToolDefinition[] = [
  tool(
    'get_face_uv',
    'Read the texture and UV mapping of brush faces: per face { faceIndex, textureId, normal, u, v, rotationDeg, scaleU, scaleV, offsetU, offsetV }. u and v rows map a brush-local point p to u = U.xyz·p + U.w (tiles). Does not change the scene.',
    { type: 'object', properties: faceTargetProperties, required: ['brushId'] },
  ),
  tool(
    'set_face_material',
    'Paint brush faces with a texture id, keeping each face UV mapping, as one undo step. Returns { editedFaceCount }.',
    {
      type: 'object',
      properties: { ...faceTargetProperties, textureId: { type: 'string' } },
      required: ['brushId', 'textureId'],
    },
  ),
  tool(
    'set_face_uv',
    'Replace the UV rows of brush faces (brush-local, as returned by get_face_uv) as one undo step. Returns { editedFaceCount }.',
    {
      type: 'object',
      properties: { ...faceTargetProperties, u: uvRowSchema, v: uvRowSchema },
      required: ['brushId', 'u', 'v'],
    },
  ),
  tool(
    'transform_face_uv',
    'Apply a face texture operation to brush faces as one undo step, like the Face inspector buttons. fit: axis u|v|both, repeatCount. justify: side left|right|top|bottom|center. align_edge: mode best|next|previous. flip: axis horizontal|vertical. rotate: degrees. shear: mode u-by-v|v-by-u, factor. scale: factorU, factorV. reset_world and reset_face take no parameters. Returns { editedFaceCount }.',
    {
      type: 'object',
      properties: {
        ...faceTargetProperties,
        operation: { type: 'string', enum: [...MCP_FACE_UV_OPERATION_NAMES] },
        axis: { type: 'string' },
        side: { type: 'string' },
        mode: { type: 'string' },
        repeatCount: { type: 'number' },
        degrees: { type: 'number' },
        factor: { type: 'number' },
        factorU: { type: 'number' },
        factorV: { type: 'number' },
      },
      required: ['brushId', 'operation'],
    },
  ),
];
