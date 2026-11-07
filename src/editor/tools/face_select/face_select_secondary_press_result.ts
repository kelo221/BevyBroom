/**
 * Result of a Face Select right-button press: whether it hit a viewport and
 * whether a paint stroke took the press instead of the texture apply click.
 */
export interface FaceSelectSecondaryPressResult {
  /** True when the press landed in a live face-mode viewport. */
  readonly viewportHit: boolean;
  /** True when a displacement paint stroke started and owns the press. */
  readonly strokeStarted: boolean;
}

/**
 * Returns a right-button press result that hit nothing.
 *
 * @returns Empty press result.
 */
export function faceSelectSecondaryPressResultMiss(): FaceSelectSecondaryPressResult {
  return { viewportHit: false, strokeStarted: false };
}
