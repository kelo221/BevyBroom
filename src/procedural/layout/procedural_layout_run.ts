import * as THREE from 'three';
import { ProceduralPartFrame } from '@/procedural/build/procedural_part_frame.js';

/** Shortest horizontal run a layout along two points accepts, in meters. */
export const PROCEDURAL_LAYOUT_RUN_MIN_LENGTH = 0.125;

/**
 * The horizontal run between two points with the frame to build parts along it:
 * the frame starts on the first point, runs toward the second and its boxes
 * rise by the slope of the line.
 */
export class ProceduralLayoutRun {
  /** Frame whose origin is the first point. */
  readonly frame: ProceduralPartFrame;
  /** Horizontal distance between the points. */
  readonly run: number;
  /** Height difference from the first to the second point. */
  readonly rise: number;

  /**
   * Creates the run between two points.
   *
   * @param start First point in owner space.
   * @param end Second point in owner space.
   */
  constructor(start: THREE.Vector3, end: THREE.Vector3) {
    const direction = new THREE.Vector3().subVectors(end, start);
    this.frame = new ProceduralPartFrame(start, direction);
    this.run = Math.hypot(direction.x, direction.z);
    this.rise = direction.y;
  }

  /**
   * Returns the rise per meter of run.
   *
   * @returns The slope, zero when the run has no length.
   */
  slope(): number {
    return this.run > 0 ? this.rise / this.run : 0;
  }

  /**
   * Returns whether the run is long enough to build along.
   *
   * @returns True when the run is at least the shortest run.
   */
  isUsable(): boolean {
    return this.run >= PROCEDURAL_LAYOUT_RUN_MIN_LENGTH;
  }
}
