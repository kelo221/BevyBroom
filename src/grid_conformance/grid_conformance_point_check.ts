import type * as THREE from 'three';

/** Axis names of a world point. */
const GRID_CONFORMANCE_AXES = ['x', 'y', 'z'] as const;
import { GRID_INTERVAL_MINIMUM } from '@/types/snap_presets.js';

/** Largest distance from a grid line still counted as on the grid. */
export const GRID_CONFORMANCE_TOLERANCE = 1e-4;

/**
 * Returns whether one coordinate lies on the minimum grid.
 *
 * @param value World coordinate.
 * @returns True when the coordinate is within tolerance of a grid line.
 */
export function gridConformanceValueOnGrid(value: number): boolean {
  const cells = value / GRID_INTERVAL_MINIMUM;
  return Math.abs(cells - Math.round(cells)) * GRID_INTERVAL_MINIMUM <= GRID_CONFORMANCE_TOLERANCE;
}

/**
 * Returns whether every coordinate of a point lies on the minimum grid.
 *
 * @param point World point.
 * @returns True when the point is a grid point.
 */
export function gridConformancePointOnGrid(point: THREE.Vector3): boolean {
  return (
    gridConformanceValueOnGrid(point.x) && gridConformanceValueOnGrid(point.y) && gridConformanceValueOnGrid(point.z)
  );
}

/**
 * Returns whether world bounds lie on the minimum grid: on every axis both ends
 * lie on the grid, or the bounds are centered on a grid line (round shapes
 * whose sides do not reach the drawn bounds).
 *
 * @param bounds World bounds.
 * @returns True when the bounds conform on every axis.
 */
export function gridConformanceBoundsOnGrid(bounds: THREE.Box3): boolean {
  return GRID_CONFORMANCE_AXES.every((axis) => {
    const minimum = bounds.min[axis];
    const maximum = bounds.max[axis];
    const endsOnGrid = gridConformanceValueOnGrid(minimum) && gridConformanceValueOnGrid(maximum);
    return endsOnGrid || gridConformanceValueOnGrid((minimum + maximum) / 2);
  });
}

/**
 * Formats a point for messages with up to five decimals.
 *
 * @param point World point.
 * @returns Text such as "(1.25, 0, -0.1)".
 */
export function gridConformancePointFormat(point: THREE.Vector3): string {
  const format = (value: number): string => String(Number(value.toFixed(5)));
  return `(${format(point.x)}, ${format(point.y)}, ${format(point.z)})`;
}
