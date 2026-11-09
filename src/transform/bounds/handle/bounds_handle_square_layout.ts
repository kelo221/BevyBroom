import * as THREE from 'three';
import { worldUnitsPerPixel } from '@/transform/bounds/bounds_handle_screen_size.js';

/** Edge length of the visible white resize square in CSS pixels. */
export const BOUNDS_SQUARE_VISUAL_PIXELS = 7;

/**
 * Edge length of the invisible pick square around a resize square in CSS
 * pixels.
 */
export const BOUNDS_SQUARE_PICK_PIXELS = 13;

/** Distance from the bounds outline to the square center in CSS pixels. */
export const BOUNDS_SQUARE_OFFSET_PIXELS = 6;

/** World-space sizes of the 2D resize squares for one zoom level. */
export interface BoundsHandleSquareLayout {
  /** Edge length of the visible square. */
  visualSize: number;
  /** Edge length of the pick square. */
  pickSize: number;
  /**
   * Distance from the bounds outline to the square center along each face
   * normal.
   */
  outwardGap: number;
  /** World units per CSS pixel the layout was built for. */
  unitsPerPixel: number;
}

/**
 * Builds the square layout for a given world size of one CSS pixel.
 *
 * @param unitsPerPixel World units covered by one CSS pixel.
 * @returns Square sizes in world units.
 */
export function boundsHandleSquareLayoutFromUnitsPerPixel(unitsPerPixel: number): BoundsHandleSquareLayout {
  const safeUnitsPerPixel = Math.max(1e-9, unitsPerPixel);
  return {
    visualSize: safeUnitsPerPixel * BOUNDS_SQUARE_VISUAL_PIXELS,
    pickSize: safeUnitsPerPixel * BOUNDS_SQUARE_PICK_PIXELS,
    outwardGap: safeUnitsPerPixel * BOUNDS_SQUARE_OFFSET_PIXELS,
    unitsPerPixel: safeUnitsPerPixel,
  };
}

/**
 * Builds the square layout for the zoom of a viewport camera.
 *
 * @param camera Viewport camera (orthographic in 2D panes).
 * @param viewportHeightPx Drawable pane height in CSS pixels.
 * @returns Square sizes in world units.
 */
export function boundsHandleSquareLayoutForCamera(
  camera: THREE.Camera,
  viewportHeightPx: number,
): BoundsHandleSquareLayout {
  return boundsHandleSquareLayoutFromUnitsPerPixel(worldUnitsPerPixel(camera, viewportHeightPx));
}

/**
 * Builds a camera-free square layout whose pick square matches a fallback world
 * size, used before the first per-frame screen sizing.
 *
 * @param fallbackPickWorldSize World edge length for the pick square.
 * @returns Square sizes in world units.
 */
export function boundsHandleSquareLayoutFromFallback(fallbackPickWorldSize: number): BoundsHandleSquareLayout {
  return boundsHandleSquareLayoutFromUnitsPerPixel(fallbackPickWorldSize / BOUNDS_SQUARE_PICK_PIXELS);
}

/**
 * Returns whether a corner square keeps clear of the edge squares beside it:
 * the half extents along both corner axes must span at least one pick square on
 * screen.
 *
 * @param smallestHalfExtent Smallest half extent along the corner axes.
 * @param layout Square layout for the current zoom.
 * @returns True when the corner square may be shown.
 */
export function boundsHandleSquareCornerFits(smallestHalfExtent: number, layout: BoundsHandleSquareLayout): boolean {
  return smallestHalfExtent >= layout.pickSize - 1e-9;
}
