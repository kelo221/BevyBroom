/**
 * Finest grid interval the editor allows (1/32 m). No grid step and no authored
 * geometry may go below it.
 */
export const GRID_INTERVAL_MINIMUM = 0.03125;

/**
 * Grid snap intervals as powers of two (binary subdivisions). Ranges from 1/32
 * to 64 so level design stays on power-of-two steps.
 */
export const SNAP_PRESETS = [GRID_INTERVAL_MINIMUM, 0.0625, 0.125, 0.25, 0.5, 1.0, 2.0, 4.0, 8.0, 16.0, 32.0, 64.0];

/**
 * Finds the index of the current snap interval in the preset array.
 *
 * @param current The current snap interval value.
 * @returns The preset index, or 0 if not found.
 */
function findPresetIndex(current: number): number {
  const index = SNAP_PRESETS.indexOf(current);
  if (index === -1) return 0;
  return index;
}

/**
 * Cycles through snap presets by the given direction and step count. Wraps
 * around at both ends of the preset list.
 *
 * @param current The current snap interval value.
 * @param direction Positive to increase, negative to decrease. Supports
 *   multi-step skips.
 * @returns The next snap interval value after cycling.
 */
export function cycleSnapInterval(current: number, direction: number): number {
  const currentIndex = findPresetIndex(current);
  const presetCount = SNAP_PRESETS.length;
  const newIndex = currentIndex + direction;
  const wrappedIndex = ((newIndex % presetCount) + presetCount) % presetCount;
  return SNAP_PRESETS[wrappedIndex]!;
}

/**
 * Clamps a grid interval so it never goes below the finest allowed grid.
 *
 * @param interval Requested grid interval in world units.
 * @returns The interval, raised to GRID_INTERVAL_MINIMUM when finer.
 */
export function gridIntervalClampToMinimum(interval: number): number {
  return Math.max(interval, GRID_INTERVAL_MINIMUM);
}
