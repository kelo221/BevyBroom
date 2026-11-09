import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  BOUNDS_SQUARE_OFFSET_PIXELS,
  BOUNDS_SQUARE_PICK_PIXELS,
  BOUNDS_SQUARE_VISUAL_PIXELS,
  boundsHandleSquareCornerFits,
  boundsHandleSquareLayoutForCamera,
  boundsHandleSquareLayoutFromFallback,
} from '@/transform/bounds/handle/bounds_handle_square_layout.js';
import { worldUnitsPerPixel } from '@/transform/bounds/bounds_handle_screen_size.js';

/**
 * Screen-space sizing of the 2D resize squares: a fixed pixel size at every
 * zoom, a pick square larger than the visible square, and a corner-overlap
 * rule.
 */
describe('bounds handle square layout', () => {
  it('converts the fixed pixel sizes to world units for the camera zoom', () => {
    const halfHeight = 7.5;
    const viewportHeight = 480;
    const camera = new THREE.OrthographicCamera(-halfHeight, halfHeight, halfHeight, -halfHeight, 0.1, 100);
    const layout = boundsHandleSquareLayoutForCamera(camera, viewportHeight);
    const unitsPerPixel = worldUnitsPerPixel(camera, viewportHeight);
    expect(layout.visualSize).toBeCloseTo(unitsPerPixel * BOUNDS_SQUARE_VISUAL_PIXELS, 10);
    expect(layout.pickSize).toBeCloseTo(unitsPerPixel * BOUNDS_SQUARE_PICK_PIXELS, 10);
    expect(layout.outwardGap).toBeCloseTo(unitsPerPixel * BOUNDS_SQUARE_OFFSET_PIXELS, 10);
  });

  it('keeps the visible square small and inside its pick square', () => {
    expect(BOUNDS_SQUARE_VISUAL_PIXELS).toBeGreaterThanOrEqual(5);
    expect(BOUNDS_SQUARE_VISUAL_PIXELS).toBeLessThanOrEqual(9);
    expect(BOUNDS_SQUARE_PICK_PIXELS).toBeGreaterThan(BOUNDS_SQUARE_VISUAL_PIXELS);
  });

  it('scales the world size with zoom so the on-screen size stays put', () => {
    const near = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 100);
    const far = new THREE.OrthographicCamera(-20, 20, 20, -20, 0.1, 100);
    const nearLayout = boundsHandleSquareLayoutForCamera(near, 512);
    const farLayout = boundsHandleSquareLayoutForCamera(far, 512);
    expect(farLayout.visualSize / nearLayout.visualSize).toBeCloseTo(10, 6);
  });

  it('builds a fallback layout whose pick square matches the fallback size', () => {
    const fallbackSize = 0.3;
    expect(boundsHandleSquareLayoutFromFallback(fallbackSize).pickSize).toBeCloseTo(fallbackSize, 10);
  });

  it('lets a corner show only when both corner half extents span a pick square', () => {
    const layout = boundsHandleSquareLayoutFromFallback(0.5);
    expect(boundsHandleSquareCornerFits(layout.pickSize * 2, layout)).toBe(true);
    expect(boundsHandleSquareCornerFits(layout.pickSize * 0.5, layout)).toBe(false);
  });
});
