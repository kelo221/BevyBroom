import type { DisplacementSculptModifiers } from '@/displacement/sculpt/displacement_sculpt_modifiers.js';
import type { DisplacementSurfaceHit } from '@/displacement/sculpt/displacement_surface_raycaster.js';

/** A viewport paint press that is held down. */
export interface DisplacementSculptPress {
  /** Keys and mouse button the press started with. */
  readonly modifiers: DisplacementSculptModifiers;
  /**
   * Surface point the brush cursor stays at while the press resizes the brush,
   * or null while painting.
   */
  readonly resizeAnchor: DisplacementSurfaceHit | null;
}

/** The displacement paint press currently held in a viewport, if any. */
export class StateDisplacementSculptPress {
  private press: DisplacementSculptPress | null = null;

  /**
   * Returns the held press.
   *
   * @returns Press, or null when no paint press is held.
   */
  pressRead(): DisplacementSculptPress | null {
    return this.press;
  }

  /**
   * Stores the held press.
   *
   * @param press Press that started, or null when it ended.
   */
  pressWrite(press: DisplacementSculptPress | null): void {
    this.press = press;
  }
}

let sharedDisplacementSculptPressState: StateDisplacementSculptPress | null = null;

/**
 * Returns the process-wide held displacement paint press.
 *
 * @returns Shared state.
 */
export function getStateDisplacementSculptPress(): StateDisplacementSculptPress {
  if (!sharedDisplacementSculptPressState) {
    sharedDisplacementSculptPressState = new StateDisplacementSculptPress();
  }
  return sharedDisplacementSculptPressState;
}
