import type * as THREE from 'three';
import { BrushResizeSession } from '@/tools/brush_resize/brush_resize_session.js';
import { getStateSprinkleTool } from '@/tools/sprinkle/state_sprinkle_tool.js';
import { SPRINKLE_RADIUS_LIMITS } from '@/tools/sprinkle/sprinkle_types.js';

/**
 * One right-button drag that resizes the Sprinkle brush: horizontal pointer
 * travel since the press changes the configured radius. Changes no scene
 * content and records no undo step.
 */
export class SprinkleBrushResizeSession extends BrushResizeSession {
  /**
   * Surface point under the press, where the radius cursor stays while
   * resizing.
   */
  readonly anchor: THREE.Vector3;

  /**
   * Starts resizing at a press.
   *
   * @param anchor Surface point under the press.
   * @param startClientX Press client X.
   */
  constructor(anchor: THREE.Vector3, startClientX: number) {
    super(startClientX, getStateSprinkleTool().configRead().radius, SPRINKLE_RADIUS_LIMITS);
    this.anchor = anchor.clone();
  }

  /**
   * Returns the configured Sprinkle radius.
   *
   * @returns Radius in meters.
   */
  protected radiusRead(): number {
    return getStateSprinkleTool().configRead().radius;
  }

  /**
   * Stores the configured Sprinkle radius.
   *
   * @param radius Radius in meters.
   */
  protected radiusWrite(radius: number): void {
    getStateSprinkleTool().configPatch({ radius });
  }
}
