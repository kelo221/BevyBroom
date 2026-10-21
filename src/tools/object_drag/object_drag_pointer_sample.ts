/** One pointer position plus the modifier keys held while it was sampled. */
export interface ObjectDragPointerSample {
  /** Pointer client X in the owning window. */
  clientX: number;
  /** Pointer client Y in the owning window. */
  clientY: number;
  /** True while Shift is held. */
  shiftKey: boolean;
  /** True while Ctrl (or Meta) is held. */
  ctrlKey: boolean;
  /** True while Alt is held. */
  altKey: boolean;
}

/**
 * Builds a pointer sample from client coordinates and modifier flags.
 *
 * @param clientX Pointer client X.
 * @param clientY Pointer client Y.
 * @param modifiers Modifier flags held at the sample.
 * @param modifiers.shiftKey True while Shift is held.
 * @param modifiers.ctrlKey True while Ctrl (or Meta) is held.
 * @param modifiers.altKey True while Alt is held.
 * @returns New pointer sample.
 */
export function objectDragPointerSampleCreate(
  clientX: number,
  clientY: number,
  modifiers: { shiftKey: boolean; ctrlKey: boolean; altKey: boolean },
): ObjectDragPointerSample {
  return {
    clientX,
    clientY,
    shiftKey: modifiers.shiftKey,
    ctrlKey: modifiers.ctrlKey,
    altKey: modifiers.altKey,
  };
}
