import type * as THREE from 'three';
import { SprinkleBrushCursor } from './sprinkle_brush_cursor.js';
import {
  RouterSprinkleBrushHover,
  type SprinkleBrushHoverPress,
  type SprinkleBrushHoverViewport,
} from './router_sprinkle_brush_hover.js';

/** Services the sprinkle viewport helpers work with. */
export interface SprinkleOverlaySystemDeps {
  /** Editor-only helper parent outside the world hierarchy. */
  readonly helperParent: THREE.Object3D;
  /** Returns every viewport the pointer may hover. */
  readonly viewportsRead: () => readonly SprinkleBrushHoverViewport[];
  /** Press state the radius cursor follows. */
  readonly press: SprinkleBrushHoverPress;
}

/**
 * Sprinkle viewport helpers: the radius sphere that follows the pointer over
 * scene surfaces while the Sprinkle tool is active. It lives under the helper
 * parent, never in the world.
 */
export class SprinkleOverlaySystem {
  /** Radius cursor. */
  readonly cursor: SprinkleBrushCursor;
  /** Pointer hover routing for the radius cursor. */
  readonly hoverRouter: RouterSprinkleBrushHover;

  /**
   * Creates the sprinkle viewport helpers.
   *
   * @param deps Helper parent, viewport services and press state.
   */
  constructor(deps: SprinkleOverlaySystemDeps) {
    this.cursor = new SprinkleBrushCursor();
    deps.helperParent.add(this.cursor.root);
    this.hoverRouter = new RouterSprinkleBrushHover({
      viewportsRead: deps.viewportsRead,
      cursor: this.cursor,
      press: deps.press,
    });
  }

  /** Updates the radius cursor for the coming frame. */
  frameUpdate(): void {
    this.hoverRouter.frameRefresh();
  }

  /** Removes and releases the sprinkle viewport helpers. */
  dispose(): void {
    this.hoverRouter.dispose();
    this.cursor.dispose();
  }
}
