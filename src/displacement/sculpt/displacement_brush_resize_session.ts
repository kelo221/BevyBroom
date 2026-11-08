import {
  DISPLACEMENT_SCULPT_RADIUS_MAX,
  DISPLACEMENT_SCULPT_RADIUS_MIN,
  getStateDisplacementSculpt,
} from '@/displacement/state/state_displacement_sculpt.js';
import { BrushResizeSession } from '@/tools/brush_resize/brush_resize_session.js';
import type { DisplacementSurfaceHit } from './displacement_surface_raycaster.js';

/**
 * One Shift + right-button drag that resizes the paint brush: horizontal
 * pointer travel since the press changes the shared paint radius. Changes no
 * geometry and records no undo step.
 */
export class DisplacementBrushResizeSession extends BrushResizeSession {
  /** Surface point under the press, where the brush cursor stays while resizing. */
  readonly anchor: DisplacementSurfaceHit;

  /**
   * Starts resizing at a press.
   *
   * @param anchor Surface point under the press.
   * @param startClientX Press client X.
   */
  constructor(anchor: DisplacementSurfaceHit, startClientX: number) {
    super(startClientX, getStateDisplacementSculpt().settingsRead().radius, {
      minimum: DISPLACEMENT_SCULPT_RADIUS_MIN,
      maximum: DISPLACEMENT_SCULPT_RADIUS_MAX,
    });
    this.anchor = { point: anchor.point.clone(), normal: anchor.normal.clone() };
  }

  /**
   * Returns the shared paint radius.
   *
   * @returns Radius in meters.
   */
  protected radiusRead(): number {
    return getStateDisplacementSculpt().settingsRead().radius;
  }

  /**
   * Stores the shared paint radius.
   *
   * @param radius Radius in meters.
   */
  protected radiusWrite(radius: number): void {
    getStateDisplacementSculpt().settingsWrite({ radius });
  }
}
