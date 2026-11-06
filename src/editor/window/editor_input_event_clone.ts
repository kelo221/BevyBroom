/**
 * Builds a bubbling, cancelable copy of a pointer event with the same pointer,
 * buttons, coordinates, movement, modifiers and pen state, ready to dispatch on
 * another element.
 *
 * @param event Original pointer event.
 * @returns New pointer event of the same type.
 */
export function editorInputPointerEventClone(event: PointerEvent): PointerEvent {
  return new PointerEvent(event.type, {
    bubbles: true,
    cancelable: true,
    composed: true,
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    isPrimary: event.isPrimary,
    button: event.button,
    buttons: event.buttons,
    clientX: event.clientX,
    clientY: event.clientY,
    screenX: event.screenX,
    screenY: event.screenY,
    movementX: event.movementX,
    movementY: event.movementY,
    ...editorInputModifierKeysRead(event),
    ...editorInputPenStateRead(event),
  });
}

/**
 * Reads the contact size, pressure and tilt of a pointer event.
 *
 * @param event Pointer event.
 * @returns Pen and touch state of the event.
 */
function editorInputPenStateRead(event: PointerEvent): PointerEventInit {
  return {
    pressure: event.pressure,
    width: event.width,
    height: event.height,
    tiltX: event.tiltX,
    tiltY: event.tiltY,
    twist: event.twist,
  };
}

/**
 * Builds a bubbling, cancelable copy of a wheel event with the same
 * coordinates, deltas and modifiers, ready to dispatch on another element.
 *
 * @param event Original wheel event.
 * @returns New wheel event of the same type.
 */
export function editorInputWheelEventClone(event: WheelEvent): WheelEvent {
  return new WheelEvent(event.type, {
    bubbles: true,
    cancelable: true,
    composed: true,
    clientX: event.clientX,
    clientY: event.clientY,
    screenX: event.screenX,
    screenY: event.screenY,
    deltaX: event.deltaX,
    deltaY: event.deltaY,
    deltaZ: event.deltaZ,
    deltaMode: event.deltaMode,
    ...editorInputModifierKeysRead(event),
  });
}

/**
 * Reads the modifier key flags of a mouse event.
 *
 * @param event Mouse, pointer or wheel event.
 * @returns Ctrl, Shift, Alt and Meta flags.
 */
function editorInputModifierKeysRead(event: MouseEvent): {
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
} {
  return { ctrlKey: event.ctrlKey, shiftKey: event.shiftKey, altKey: event.altKey, metaKey: event.metaKey };
}
