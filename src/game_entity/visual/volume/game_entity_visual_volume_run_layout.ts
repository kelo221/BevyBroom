import type * as THREE from 'three';

/** Local horizontal axis a volume's runs follow. */
export type GameEntityVolumeRunAxis = 'x' | 'z';

/**
 * Meters, after scale, by which the X extent may fall short of the Z extent and
 * still count as a tie that X wins.
 */
export const GAME_ENTITY_VOLUME_RUN_AXIS_TIE_TOLERANCE = 1e-4;

/** One band of a volume's floor, in the volume's local space. */
export interface GameEntityVolumeRunBand {
  /** Position of the band in the list, starting at zero. */
  index: number;
  /** Local coordinate along the run axis where the band starts. */
  start: number;
  /** Local coordinate along the run axis where the band ends. */
  end: number;
}

/** Bands of a volume's floor and the axis they follow. */
export interface GameEntityVolumeRunLayout {
  axis: GameEntityVolumeRunAxis;
  bands: GameEntityVolumeRunBand[];
}

/**
 * Splits a volume's floor into equal runs: along local X when its X extent is
 * at least its Z extent (within
 * {@link GAME_ENTITY_VOLUME_RUN_AXIS_TIE_TOLERANCE}), else along local Z, the
 * first band at the axis's negative end.
 */
export class GameEntityVisualVolumeRunLayout {
  /**
   * Returns the axis runs follow.
   *
   * @param localBounds Volume bounds in its local space.
   * @param scale Local scale of the volume, applied to the extents.
   * @returns `x` when the scaled X extent is at least the scaled Z extent less
   *   the tie tolerance, else `z`.
   */
  static axisOf(localBounds: THREE.Box3, scale: THREE.Vector3): GameEntityVolumeRunAxis {
    const extentX = (localBounds.max.x - localBounds.min.x) * Math.abs(scale.x);
    const extentZ = (localBounds.max.z - localBounds.min.z) * Math.abs(scale.z);
    return extentX >= extentZ - GAME_ENTITY_VOLUME_RUN_AXIS_TIE_TOLERANCE ? 'x' : 'z';
  }

  /**
   * Returns the bands of a volume holding a number of runs.
   *
   * @param localBounds Volume bounds in its local space.
   * @param scale Local scale of the volume, applied to the extents.
   * @param runCount Number of runs.
   * @returns Axis and one equal band per run, in order from the negative end.
   */
  static layoutOf(localBounds: THREE.Box3, scale: THREE.Vector3, runCount: number): GameEntityVolumeRunLayout {
    const axis = GameEntityVisualVolumeRunLayout.axisOf(localBounds, scale);
    const axisStart = localBounds.min[axis];
    const bandLength = (localBounds.max[axis] - axisStart) / Math.max(1, runCount);
    const bands = Array.from({ length: Math.max(0, runCount) }, (_unused, index) => ({
      index,
      start: axisStart + bandLength * index,
      end: axisStart + bandLength * (index + 1),
    }));
    return { axis, bands };
  }
}
