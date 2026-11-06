/** Longest time between two presses that still counts as a double-click. */
export const POINTER_DOUBLE_CLICK_MAX_INTERVAL_MS = 400;

/** Largest client-pixel drift between two presses of a double-click. */
export const POINTER_DOUBLE_CLICK_MAX_DISTANCE_PX = 6;

/**
 * Tells whether a press completes a double-click with the press before it: the
 * two presses must land close together in time and on screen.
 */
export class PointerDoubleClickDetector {
  private lastPressTimeMs = Number.NEGATIVE_INFINITY;
  private lastPressClientX = 0;
  private lastPressClientY = 0;

  /**
   * Records a press and reports whether it completes a double-click.
   *
   * @param clientX Press client X.
   * @param clientY Press client Y.
   * @param nowMs Press time in milliseconds; the current time when omitted.
   * @returns True when the press is the second press of a double-click.
   */
  pressRegister(clientX: number, clientY: number, nowMs: number = performance.now()): boolean {
    const isDoubleClick = this.pressIsCloseToLastPress(clientX, clientY, nowMs);
    this.lastPressTimeMs = nowMs;
    this.lastPressClientX = clientX;
    this.lastPressClientY = clientY;
    return isDoubleClick;
  }

  /** Forgets the last press so the next press starts a new double-click. */
  reset(): void {
    this.lastPressTimeMs = Number.NEGATIVE_INFINITY;
  }

  /**
   * Returns whether a press lies within the double-click time and distance of
   * the last press.
   *
   * @param clientX Press client X.
   * @param clientY Press client Y.
   * @param nowMs Press time in milliseconds.
   * @returns True when the press is close enough to the last press.
   */
  private pressIsCloseToLastPress(clientX: number, clientY: number, nowMs: number): boolean {
    return (
      nowMs - this.lastPressTimeMs <= POINTER_DOUBLE_CLICK_MAX_INTERVAL_MS &&
      Math.abs(clientX - this.lastPressClientX) <= POINTER_DOUBLE_CLICK_MAX_DISTANCE_PX &&
      Math.abs(clientY - this.lastPressClientY) <= POINTER_DOUBLE_CLICK_MAX_DISTANCE_PX
    );
  }
}
