import * as THREE from 'three';
import type {
  DisplacementPaintTool,
  DisplacementSculptAxis,
  DisplacementSculptEdge,
  DisplacementSculptEffect,
} from '@/displacement/model/displacement_types.js';
import type { DisplacementSculptSettings } from '@/displacement/state/state_displacement_sculpt.js';

/** Tool, brush shape and strength of a sculpt stroke. */
export interface DisplacementSculptStrokeSettings {
  /** Paint tool: Paint Geometry or Paint Alpha. */
  tool: DisplacementPaintTool;
  /** Paint Geometry effect. */
  effect: DisplacementSculptEffect;
  /** World radius of each dab. */
  radius: number;
  /** World distance one dab moves the center vertex; Raise To's target height. */
  distance: number;
  /** 1 raises (or paints the alpha value), -1 lowers (or paints alpha 0). */
  direction: 1 | -1;
  /** Random seed for effects with random output. */
  seed: number;
  /** Dab falloff. */
  edge: DisplacementSculptEdge;
  /** False weighs only the vertex nearest each dab center. */
  spatial: boolean;
  /** Direction dabs move vertices along. */
  axis: DisplacementSculptAxis;
  /** Alpha Paint Alpha paints towards. */
  alphaValue: number;
  /** Whether finishing the stroke sews the shared edges of its faces. */
  autoSew: boolean;
}

/**
 * Builds stroke settings from the shared Displacement tab settings.
 *
 * @param settings Shared displacement sculpt settings.
 * @param direction 1 to raise, -1 to lower.
 * @param seed Random seed of the stroke.
 * @returns Stroke settings; the Select tool maps to Paint Geometry.
 */
export function displacementSculptStrokeSettingsFromShared(
  settings: Readonly<DisplacementSculptSettings>,
  direction: 1 | -1,
  seed: number,
): DisplacementSculptStrokeSettings {
  return {
    tool: settings.activeTool === 'paint_alpha' ? 'paint_alpha' : 'paint_geometry',
    effect: settings.effect,
    radius: settings.radius,
    distance: settings.distance,
    direction,
    seed,
    edge: settings.edge,
    spatial: settings.spatial,
    axis: settings.axis,
    alphaValue: settings.alphaValue,
    autoSew: settings.autoSew,
  };
}

/**
 * Returns the world direction of a paint axis.
 *
 * @param axis Paint axis.
 * @returns New unit world vector, or null for the face normal.
 */
export function displacementSculptAxisVectorRead(axis: DisplacementSculptAxis): THREE.Vector3 | null {
  switch (axis) {
    case 'face_normal':
      return null;
    case 'x':
      return new THREE.Vector3(1, 0, 0);
    case 'y':
      return new THREE.Vector3(0, 1, 0);
    case 'z':
      return new THREE.Vector3(0, 0, 1);
  }
}
