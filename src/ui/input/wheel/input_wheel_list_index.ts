import type { InputWheelStep } from './input_wheel_step.js';

/**
 * Finds the list entry one wheel notch moves to. Scrolling down moves to the
 * next entry and scrolling up to the previous one, as Windows list controls do.
 * Entries that are not selectable are skipped and the search stops at the list
 * ends without wrapping. Modifier multipliers do not apply to lists.
 *
 * @param currentIndex Index of the current entry, or -1 when none is chosen.
 * @param entryCount Number of entries in the list.
 * @param step Wheel step to apply.
 * @param entrySelectableRead Returns whether the entry at an index may be
 *   chosen.
 * @returns Index of the entry to choose, or null when no entry lies that way.
 */
export function inputWheelListIndexStep(
  currentIndex: number,
  entryCount: number,
  step: InputWheelStep,
  entrySelectableRead: (index: number) => boolean,
): number | null {
  const indexDelta = -step.direction;
  for (let index = currentIndex + indexDelta; index >= 0 && index < entryCount; index += indexDelta) {
    if (entrySelectableRead(index)) {
      return index;
    }
  }
  return null;
}
