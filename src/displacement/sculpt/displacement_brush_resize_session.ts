import { getStateDisplacementSculpt } from '@/displacement/state/state_displacement_sculpt.js';
import type { DisplacementSurfaceHit } from './displacement_surface_raycaster.js';
import { displacementBrushResizeRadiusCompute } from './displacement_brush_resize_radius.js';

/**
 * One Shift + right-button drag that resizes the paint brush: horizontal
 * pointer travel since the press changes the shared paint radius. Changes no
 * geometry and records no undo step.
 */
export class DisplacementBrushResizeSession {
  /** Surface point under the press, where the brush cursor stays while resizing. */
  readonly anchor: DisplacementSurfaceHit;
  private readonly startClientX: number;
  private readonly startRadius: number;

  /**
   * Starts resizing at a press.
   *
   * @param anchor Surface point under the press.
   * @param startClientX Press client X.
   */
  constructor(anchor: DisplacementSurfaceHit, startClientX: number) {
    this.anchor = { point: anchor.point.clone(), normal: anchor.normal.clone() };
    this.startClientX = startClientX;
    this.startRadius = getStateDisplacementSculpt().settingsRead().radius;
  }

  /**
   * Sets the shared paint radius for the pointer's horizontal travel since the
   * press.
   *
   * @param clientX Current pointer client X.
   */
  pointerUpdate(clientX: number): void {
    const radius = displacementBrushResizeRadiusCompute(this.startRadius, clientX - this.startClientX);
    const state = getStateDisplacementSculpt();
    if (radius !== state.settingsRead().radius) {
      state.settingsWrite({ radius });
    }
  }
}
