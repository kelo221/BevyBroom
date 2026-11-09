import type * as THREE from 'three';
import { findPickSurfaceAtClientPoint } from '@/utils/pointer_client_hit.js';
import { createSyntheticPointerDown, createSyntheticPointerMove } from '@/utils/synthetic_pointer_event.js';
import type { SprinkleStrokeResult } from '@/tools/sprinkle/stroke/sprinkle_stroke_types.js';
import type { RouterSprinklePointer, SprinklePressButton } from './router_sprinkle_pointer.js';

/** Mouse button index of the left button. */
const SPRINKLE_POINTER_PRIMARY_BUTTON = 0;

/** Mouse button index of the right button. */
const SPRINKLE_POINTER_SECONDARY_BUTTON = 2;

/** Viewport a Sprinkle press may land in (2D and 3D panes satisfy it). */
export interface SprinklePointerViewport {
  /** Returns the viewport camera. */
  getCamera(): THREE.Camera;
  /** Returns the element whose bounds receive the viewport's pointer input. */
  getContentElement(): HTMLElement;
}

/**
 * Feeds client-point presses of the editor's tools into the Sprinkle pointer
 * router: finds the viewport under a press, keeps it for the whole press and
 * remembers which mouse button holds it.
 */
export class SprinklePointerViewportRouting {
  private pressedViewport: SprinklePointerViewport | null = null;
  private pressedButtonIndex: number | null = null;

  /**
   * Creates the routing.
   *
   * @param router Sprinkle pointer router.
   * @param viewportsRead Returns every viewport a press may land in.
   */
  constructor(
    readonly router: RouterSprinklePointer,
    private readonly viewportsRead: () => readonly SprinklePointerViewport[],
  ) {}

  /**
   * Returns whether presses should paint instead of selecting.
   *
   * @returns True while the Sprinkle tool is active.
   */
  isRoutingActive(): boolean {
    return this.router.isRoutingActive();
  }

  /**
   * Returns whether a press held by a mouse button paints or resizes.
   *
   * @param buttonIndex Mouse button index.
   * @returns True while that button holds a Sprinkle press.
   */
  isPressHeldBy(buttonIndex: number): boolean {
    return this.pressedButtonIndex === buttonIndex && this.router.isPressActive();
  }

  /**
   * Returns whether any Sprinkle press is held.
   *
   * @returns True between a consumed press and its release.
   */
  isPressActive(): boolean {
    return this.pressedButtonIndex !== null && this.router.isPressActive();
  }

  /**
   * Starts a stroke for the left button or a resize for the right button when
   * the press hits a surface in a viewport.
   *
   * @param clientX Press client X.
   * @param clientY Press client Y.
   * @param buttonIndex Mouse button index of the press.
   * @param ownerDocument Document owning the client coordinates, or null.
   * @returns True when the press is now held by the Sprinkle tool.
   */
  pressBegin(clientX: number, clientY: number, buttonIndex: number, ownerDocument: Document | null): boolean {
    const pressButton = SprinklePointerViewportRouting.pressButtonRead(buttonIndex);
    const viewport = pressButton ? this.viewportAt(clientX, clientY, ownerDocument) : null;
    if (!pressButton || !viewport) {
      return false;
    }
    const event = createSyntheticPointerDown(clientX, clientY);
    if (!this.router.strokeTryBegin(event, viewport.getCamera(), viewport.getContentElement(), pressButton)) {
      return false;
    }
    this.pressedViewport = viewport;
    this.pressedButtonIndex = buttonIndex;
    return true;
  }

  /**
   * Feeds a pointer sample of the held press.
   *
   * @param clientX Pointer client X.
   * @param clientY Pointer client Y.
   */
  pressMove(clientX: number, clientY: number): void {
    const viewport = this.pressedViewport;
    if (!viewport) {
      return;
    }
    const event = createSyntheticPointerMove(clientX, clientY);
    this.router.strokeContinue(event, viewport.getCamera(), viewport.getContentElement());
  }

  /**
   * Ends the press when the released button holds it.
   *
   * @param buttonIndex Released mouse button index.
   * @returns Stroke result, or null when the button held no Sprinkle press.
   */
  pressEnd(buttonIndex: number): SprinkleStrokeResult | null {
    if (this.pressedButtonIndex !== buttonIndex) {
      return null;
    }
    this.pressedViewport = null;
    this.pressedButtonIndex = null;
    return this.router.strokeEnd();
  }

  /**
   * Finds the viewport under a client point.
   *
   * @param clientX Client X.
   * @param clientY Client Y.
   * @param ownerDocument Document owning the coordinates, or null.
   * @returns Viewport, or null.
   */
  private viewportAt(clientX: number, clientY: number, ownerDocument: Document | null): SprinklePointerViewport | null {
    return findPickSurfaceAtClientPoint(
      this.viewportsRead(),
      (viewport) => viewport.getContentElement(),
      clientX,
      clientY,
      ownerDocument,
    );
  }

  /**
   * Maps a mouse button index onto a Sprinkle press button.
   *
   * @param buttonIndex Mouse button index.
   * @returns Press button, or null for buttons the Sprinkle tool ignores.
   */
  private static pressButtonRead(buttonIndex: number): SprinklePressButton | null {
    if (buttonIndex === SPRINKLE_POINTER_PRIMARY_BUTTON) {
      return 'primary';
    }
    return buttonIndex === SPRINKLE_POINTER_SECONDARY_BUTTON ? 'secondary' : null;
  }
}
