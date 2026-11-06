import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import { displacementFaceAttachedIs } from '@/displacement/model/displacement_face_eligibility.js';

/**
 * Returns whether a brush is represented only by its displacement surfaces: at
 * least one of its faces shows an attached displacement, so none of its own
 * face triangles are drawn or exported.
 *
 * @param brush Brush to test.
 * @returns True when any face of the brush carries an attached displacement.
 */
export function displacementBrushDisplacedIs(brush: SolidBrushInstance): boolean {
  return brush.faceDisplacementIndices().some((surfaceIndex) => displacementFaceAttachedIs(brush, surfaceIndex));
}
