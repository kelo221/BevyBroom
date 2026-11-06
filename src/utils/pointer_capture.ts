/**
 * Captures a pointer on an element when the browser supports it.
 *
 * @param element Element that should own the pointer.
 * @param pointerId Pointer id to capture, if any.
 * @returns True when capture was requested without throwing.
 */
export function pointerCaptureTry(element: HTMLElement, pointerId?: number): boolean {
  if (pointerId === undefined || typeof element.setPointerCapture !== 'function') {
    return false;
  }
  try {
    element.setPointerCapture(pointerId);
    return true;
  } catch {
    return false;
  }
}
