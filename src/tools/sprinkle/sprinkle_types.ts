import type * as THREE from 'three';
import type { BrushResizeRadiusLimits } from '@/tools/brush_resize/brush_resize_radius.js';

/**
 * Sprinkle placement operation mode matching the Hammer++ Entity Sprinkle
 * modes.
 */
export type SprinklePlacementMode = 'ADDITIVE' | 'SUBTRACTIVE' | 'REPLACE' | 'OVERWRITE';

/**
 * Every Sprinkle placement mode in the order the Entity Sprinkle window lists
 * them.
 */
export const SPRINKLE_PLACEMENT_MODES: readonly SprinklePlacementMode[] = Object.freeze([
  'ADDITIVE',
  'SUBTRACTIVE',
  'REPLACE',
  'OVERWRITE',
]);

/** Smallest Sprinkle radius in meters. */
export const SPRINKLE_RADIUS_MIN = 0.25;

/** Largest Sprinkle radius in meters. */
export const SPRINKLE_RADIUS_MAX = 256;

/** Smallest and largest Sprinkle radius in meters. */
export const SPRINKLE_RADIUS_LIMITS: BrushResizeRadiusLimits = Object.freeze({
  minimum: SPRINKLE_RADIUS_MIN,
  maximum: SPRINKLE_RADIUS_MAX,
});

/** Smallest Sprinkle grid cell size in meters. */
export const SPRINKLE_GRID_SIZE_MIN = 0.05;

/** Configuration of the Hammer++ Entity Sprinkle tool. */
export interface SprinkleConfig {
  /** Name of the active sprinkle definition, or null when none is chosen. */
  definitionName: string | null;
  /** Brush radius in meters. */
  radius: number;
  /**
   * Chance in percent (0 to 100) that a grid cell inside the radius receives an
   * entity.
   */
  densityPercent: number;
  /** Placement operation mode. */
  mode: SprinklePlacementMode;
  /**
   * Grid shift in meters along the first in-plane axis of the surface's grid
   * plane.
   */
  gridOffsetU: number;
  /**
   * Grid shift in meters along the second in-plane axis of the surface's grid
   * plane.
   */
  gridOffsetV: number;
  /** Custom grid cell size in meters along the first in-plane axis. */
  gridSizeU: number;
  /** Custom grid cell size in meters along the second in-plane axis. */
  gridSizeV: number;
  /** Whether the active definition's grid replaces the custom grid size. */
  gridSizeFromDefinition: boolean;
  /** Whether placed entities receive a random yaw around their up axis. */
  randomYaw: boolean;
  /** Whether placed entities tilt their +Y axis to the surface normal. */
  alignToNormal: boolean;
  /** Seed of the placement random number generator. */
  seed: number;
}

/** Surface hit returned by a raycast projection query. */
export interface SprinkleSurfaceHit {
  /** World-space hit position. */
  point: THREE.Vector3;
  /** World-space unit surface normal at the hit. */
  normal: THREE.Vector3;
}
