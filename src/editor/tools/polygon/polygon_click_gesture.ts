/**
 * Largest pointer travel in pixels between press and release that still counts
 * as a click placing a Polygon point.
 */
export const POLYGON_CLICK_JITTER_TOLERANCE_PX = 8;

/** Client position of a Polygon click. */
export interface PolygonClickPoint {
  /** Client X of the press. */
  clientX: number;
  /** Client Y of the press. */
  clientY: number;
}

/**
 * Tells a Polygon click from a drag: a release close to its press is a click at
 * the press position, so small pointer jitter never loses a point.
 */
export class PolygonClickGesture {
  private press: PolygonClickPoint | null = null;

  /**
   * Records a left-button press.
   *
   * @param clientX Press client X.
   * @param clientY Press client Y.
   */
  pressBegin(clientX: number, clientY: number): void {
    this.press = { clientX, clientY };
  }

  /**
   * Returns whether a press waits for its release.
   *
   * @returns True between a press and its release.
   */
  isPressed(): boolean {
    return this.press !== null;
  }

  /**
   * Ends the press and returns where the click aimed.
   *
   * @param clientX Release client X.
   * @param clientY Release client Y.
   * @returns Press position when the release stayed within the jitter
   *   tolerance, otherwise null.
   */
  release(clientX: number, clientY: number): PolygonClickPoint | null {
    const press = this.press;
    this.press = null;
    if (!press) {
      return null;
    }
    const travel = Math.hypot(clientX - press.clientX, clientY - press.clientY);
    return travel <= POLYGON_CLICK_JITTER_TOLERANCE_PX ? press : null;
  }

  /** Forgets a press without placing a point. */
  reset(): void {
    this.press = null;
  }
}
