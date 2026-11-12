/** Bit of the PointerEvent.buttons field for each mouse button index. */
const PLATFORM_POINTER_BUTTONS_BIT_BY_BUTTON: readonly number[] = [1, 4, 2];

/**
 * Returns the PointerEvent.buttons bit of a mouse button index.
 *
 * @param button Mouse button index (0 primary, 1 middle, 2 secondary).
 * @returns Bit value of that button in the buttons field, or 0 when unknown.
 */
export function platformPointerButtonsBit(button: number): number {
  return PLATFORM_POINTER_BUTTONS_BIT_BY_BUTTON[button] ?? 0;
}

/**
 * Rewrites a PointerEvent.buttons field so the primary button reads as another
 * button.
 *
 * @param buttons Buttons field reported by the browser.
 * @param replacementButton Button index the primary button stands in for.
 * @returns Buttons field with the primary bit moved onto the replacement.
 */
export function platformPointerButtonsRemap(buttons: number, replacementButton: number): number {
  const primaryBit = platformPointerButtonsBit(0);
  if ((buttons & primaryBit) === 0) {
    return buttons;
  }
  return (buttons & ~primaryBit) | platformPointerButtonsBit(replacementButton);
}

/**
 * Reads the init fields shared by mouse and pointer events.
 *
 * @param event Mouse or pointer event.
 * @param button Button index of the copy.
 * @param buttons Buttons field of the copy.
 * @returns Mouse event init.
 */
function platformPointerMouseInitRead(event: MouseEvent, button: number, buttons: number): MouseEventInit {
  return {
    bubbles: true,
    cancelable: true,
    composed: true,
    button,
    buttons,
    clientX: event.clientX,
    clientY: event.clientY,
    screenX: event.screenX,
    screenY: event.screenY,
    movementX: event.movementX,
    movementY: event.movementY,
    ctrlKey: event.ctrlKey,
    shiftKey: event.shiftKey,
    altKey: event.altKey,
    metaKey: event.metaKey,
    relatedTarget: event.relatedTarget,
  };
}

/**
 * Builds a bubbling, cancelable copy of a pointer event that reports another
 * button, keeping its pointer, coordinates, movement, modifiers and pen state.
 *
 * @param event Original pointer event.
 * @param button Button index of the copy.
 * @param buttons Buttons field of the copy.
 * @returns New pointer event of the same type.
 */
export function platformPointerEventCloneWithButton(
  event: PointerEvent,
  button: number,
  buttons: number,
): PointerEvent {
  return new PointerEvent(event.type, {
    ...platformPointerMouseInitRead(event, button, buttons),
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    isPrimary: event.isPrimary,
    pressure: event.pressure,
    width: event.width,
    height: event.height,
    tiltX: event.tiltX,
    tiltY: event.tiltY,
    twist: event.twist,
  });
}

/**
 * Builds a bubbling, cancelable mouse event of a given type from a pointer
 * event, reporting another button.
 *
 * @param event Pointer event the mouse event mirrors.
 * @param type Mouse event type such as "mousedown".
 * @param button Button index of the copy.
 * @param buttons Buttons field of the copy.
 * @returns New mouse event.
 */
export function platformPointerMouseEventCreate(
  event: PointerEvent,
  type: string,
  button: number,
  buttons: number,
): MouseEvent {
  return new MouseEvent(type, platformPointerMouseInitRead(event, button, buttons));
}
