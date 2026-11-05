import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';
import { DisplacementGrid } from '@/displacement/grid/displacement_grid.js';

/**
 * Returns why a brush face cannot carry a displacement: only four-sided faces
 * of additive brushes can.
 *
 * @param brush Brush owning the face.
 * @param surfaceIndex Face index.
 * @returns Failure message, or null when the face can be displaced.
 */
export function displacementFaceFailureRead(brush: SolidBrushInstance, surfaceIndex: number): string | null {
  if (brush.operation !== SolidOperation.Additive) {
    return `Displacements need an additive brush; ${brush.name} is not additive`;
  }
  return DisplacementGrid.faceFailureRead(brush.brush, surfaceIndex);
}

/**
 * Returns whether a brush face shows a displacement surface in place of its own
 * triangles: it carries a displacement and can be displaced.
 *
 * @param brush Brush owning the face.
 * @param surfaceIndex Face index.
 * @returns True when the face is replaced by a displacement surface.
 */
export function displacementFaceAttachedIs(brush: SolidBrushInstance, surfaceIndex: number): boolean {
  return (
    brush.faceDisplacementRead(surfaceIndex) !== undefined && displacementFaceFailureRead(brush, surfaceIndex) === null
  );
}
