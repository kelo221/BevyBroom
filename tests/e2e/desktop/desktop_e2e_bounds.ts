import type { McpBounds, McpVec3 } from '@/ai/shared/mcp_protocol_types.js';

/**
 * Returns a point on the top face of world bounds halfway between the face
 * center and its +X +Z corner. Pressing there hits the box itself, clear of the
 * bounds resize handle at the face center.
 *
 * @param bounds World bounds of a box.
 * @returns World point on the top face.
 */
export function desktopE2eBoundsTopFaceGripPoint(bounds: McpBounds): McpVec3 {
  return {
    x: (bounds.min.x + 3 * bounds.max.x) / 4,
    y: bounds.max.y,
    z: (bounds.min.z + 3 * bounds.max.z) / 4,
  };
}
