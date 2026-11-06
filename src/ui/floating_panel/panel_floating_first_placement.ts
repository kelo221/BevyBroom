/** Maximum animation frames a first placement waits for a sized anchor. */
export const FLOATING_PANEL_FIRST_PLACEMENT_RETRY_MAX = 8;

/**
 * Returns whether a placement-anchor rect has no usable size.
 *
 * @param rect Anchor getBoundingClientRect.
 * @returns True when width or height is not positive.
 */
export function placementAnchorRectIsDegenerate(rect: DOMRectReadOnly): boolean {
  return rect.width <= 0 || rect.height <= 0;
}

/**
 * Cancels a scheduled first-placement retry when one is pending.
 *
 * @param retryFrameId RequestAnimationFrame id, or null.
 */
export function freeFirstPlacementRetryCancel(retryFrameId: number | null): void {
  if (retryFrameId === null) {
    return;
  }
  cancelAnimationFrame(retryFrameId);
}

/**
 * Schedules one first-placement retry on the next animation frame.
 *
 * @param retry Callback invoked on the next frame.
 * @returns The scheduled requestAnimationFrame id.
 */
export function freeFirstPlacementRetrySchedule(retry: () => void): number {
  return requestAnimationFrame(retry);
}

/**
 * Returns whether another first-placement retry may run.
 *
 * @param retryCount Retries already scheduled after the first placement.
 * @returns True while the retry count is below the cap.
 */
export function freeFirstPlacementRetryRemaining(retryCount: number): boolean {
  return retryCount < FLOATING_PANEL_FIRST_PLACEMENT_RETRY_MAX;
}
