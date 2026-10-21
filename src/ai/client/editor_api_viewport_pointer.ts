import type { PointerClientPoint } from '@/utils/pointer_client_project.js';

/** Modifier keys an MCP viewport input holds for its whole gesture. */
export interface EditorApiViewportKeys {
  /** True to hold Ctrl. */
  ctrl: boolean;
  /** True to hold Shift. */
  shift: boolean;
  /** True to hold Alt. */
  alt: boolean;
}

/** Pointer id used for every synthesized MCP mouse gesture. */
const EDITOR_API_VIEWPORT_POINTER_ID = 1;

/**
 * Dispatches real left-button mouse pointer events on a viewport element, the
 * same events a user's mouse produces, so the editor's own input routing
 * handles them.
 */
export class EditorApiViewportPointer {
  private readonly element: HTMLElement;
  private readonly keys: EditorApiViewportKeys;

  /**
   * Creates a pointer for one gesture.
   *
   * @param element Viewport content element receiving the events.
   * @param keys Modifier keys held during the gesture.
   */
  constructor(element: HTMLElement, keys: EditorApiViewportKeys) {
    this.element = element;
    this.keys = keys;
  }

  /**
   * Moves the pointer over a point with no button held.
   *
   * @param point Client point.
   */
  hover(point: PointerClientPoint): void {
    this.pointerEventDispatch('pointermove', point, -1, 0);
  }

  /**
   * Presses the left button at a point.
   *
   * @param point Client point.
   */
  press(point: PointerClientPoint): void {
    this.pointerEventDispatch('pointerdown', point, 0, 1);
  }

  /**
   * Moves the pointer to a point with the left button held.
   *
   * @param point Client point.
   */
  dragTo(point: PointerClientPoint): void {
    this.pointerEventDispatch('pointermove', point, -1, 1);
  }

  /**
   * Releases the left button at a point.
   *
   * @param point Client point.
   */
  release(point: PointerClientPoint): void {
    this.pointerEventDispatch('pointerup', point, 0, 0);
  }

  /**
   * Dispatches one bubbling mouse pointer event on the element.
   *
   * @param type Pointer event type.
   * @param point Client point.
   * @param button Changed button (-1 for moves).
   * @param buttons Bit mask of held buttons.
   */
  private pointerEventDispatch(type: string, point: PointerClientPoint, button: number, buttons: number): void {
    const event = new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX: point.clientX,
      clientY: point.clientY,
      button,
      buttons,
      pointerId: EDITOR_API_VIEWPORT_POINTER_ID,
      pointerType: 'mouse',
      isPrimary: true,
      ctrlKey: this.keys.ctrl,
      shiftKey: this.keys.shift,
      altKey: this.keys.alt,
    });
    this.element.dispatchEvent(event);
  }
}
