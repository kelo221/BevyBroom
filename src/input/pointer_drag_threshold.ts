/**
 * Screen distance in pixels a held pointer must travel before a press becomes a
 * drag.
 */
export const POINTER_DRAG_THRESHOLD_PIXELS = 4;

/**
 * Returns whether a pointer moved far enough from its press point to count as a
 * drag instead of a click.
 *
 * @param pressClientX Client X where the button went down.
 * @param pressClientY Client Y where the button went down.
 * @param currentClientX Current client X.
 * @param currentClientY Current client Y.
 * @returns True once the travel exceeds {@link POINTER_DRAG_THRESHOLD_PIXELS}.
 */
export function pointerDragThresholdExceeded(
  pressClientX: number,
  pressClientY: number,
  currentClientX: number,
  currentClientY: number,
): boolean {
  const travelX = currentClientX - pressClientX;
  const travelY = currentClientY - pressClientY;
  return travelX * travelX + travelY * travelY > POINTER_DRAG_THRESHOLD_PIXELS * POINTER_DRAG_THRESHOLD_PIXELS;
}
