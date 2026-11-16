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

/**
 * Reads an optional MCP keys argument of ctrl, shift and alt booleans.
 *
 * @param value Argument value; undefined holds no keys.
 * @returns Held keys, or null when the value is not such an object.
 */
export function editorApiModifierKeysRead(value: unknown): EditorApiViewportKeys | null {
  if (value === undefined) {
    return { ctrl: false, shift: false, alt: false };
  }
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const names = ['ctrl', 'shift', 'alt'];
  if (!names.every((keyName) => record[keyName] === undefined || typeof record[keyName] === 'boolean')) {
    return null;
  }
  return { ctrl: record['ctrl'] === true, shift: record['shift'] === true, alt: record['alt'] === true };
}

/** Mouse button an MCP viewport input presses. */
export type EditorApiViewportButton = 'left' | 'right';

/** Changed-button index and held-buttons mask of one mouse button. */
interface EditorApiViewportButtonCodes {
  readonly index: number;
  readonly mask: number;
}

/** Button codes of each pressable mouse button. */
const EDITOR_API_VIEWPORT_BUTTON_CODES: Readonly<Record<EditorApiViewportButton, EditorApiViewportButtonCodes>> = {
  left: { index: 0, mask: 1 },
  right: { index: 2, mask: 2 },
};

/** Pointer id used for every synthesized MCP mouse gesture. */
const EDITOR_API_VIEWPORT_POINTER_ID = 1;

/**
 * Dispatches real mouse pointer events of one button on a viewport element, the
 * same events a user's mouse produces, so the editor's own input routing
 * handles them.
 */
export class EditorApiViewportPointer {
  private readonly element: HTMLElement;
  private readonly keys: EditorApiViewportKeys;
  private readonly button: EditorApiViewportButtonCodes;

  /**
   * Creates a pointer for one gesture.
   *
   * @param element Viewport content element receiving the events.
   * @param keys Modifier keys held during the gesture.
   * @param button Mouse button the gesture presses; left when omitted.
   */
  constructor(element: HTMLElement, keys: EditorApiViewportKeys, button: EditorApiViewportButton = 'left') {
    this.element = element;
    this.keys = keys;
    this.button = EDITOR_API_VIEWPORT_BUTTON_CODES[button];
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
   * Presses the gesture's button at a point.
   *
   * @param point Client point.
   */
  press(point: PointerClientPoint): void {
    this.pointerEventDispatch('pointerdown', point, this.button.index, this.button.mask);
  }

  /**
   * Moves the pointer to a point with the gesture's button held.
   *
   * @param point Client point.
   */
  dragTo(point: PointerClientPoint): void {
    this.pointerEventDispatch('pointermove', point, -1, this.button.mask);
  }

  /**
   * Releases the gesture's button at a point.
   *
   * @param point Client point.
   */
  release(point: PointerClientPoint): void {
    this.pointerEventDispatch('pointerup', point, this.button.index, 0);
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
