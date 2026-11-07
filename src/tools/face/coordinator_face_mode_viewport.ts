import { Viewport3D } from '@/viewports/core/viewport_3d.js';
import { Viewport2D } from '@/viewports/core/viewport_2d.js';
import { findPickSurfaceAtClientPoint } from '@/utils/pointer_client_hit.js';

/** Viewport a Face Select pointer sample can land in. */
export type CoordinatorFaceModeViewport = Viewport3D | Viewport2D;

/**
 * Finds the viewport under a client point while face mode is active.
 *
 * @param isFaceMode True while Face Select owns selection.
 * @param viewports Live editor viewports.
 * @param clientX Pointer client X.
 * @param clientY Pointer client Y.
 * @param ownerDocument Document that owns the client coordinates, or null.
 * @returns Viewport, or null outside face mode or any viewport.
 */
export function coordinatorFaceModeViewportAtClientPoint(
  isFaceMode: boolean,
  viewports: readonly CoordinatorFaceModeViewport[],
  clientX: number,
  clientY: number,
  ownerDocument: Document | null,
): CoordinatorFaceModeViewport | null {
  if (!isFaceMode) {
    return null;
  }
  return findPickSurfaceAtClientPoint(
    viewports,
    (viewport) => viewport.getContentElement(),
    clientX,
    clientY,
    ownerDocument,
  );
}
