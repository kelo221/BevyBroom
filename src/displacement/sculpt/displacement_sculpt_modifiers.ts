import type { DisplacementSculptSettings } from '@/displacement/state/state_displacement_sculpt.js';

/** Mouse button of a viewport paint press. */
export type DisplacementSculptPressButton = 'primary' | 'secondary';

/** Keys and mouse button that change what a displacement paint press does. */
export interface DisplacementSculptModifiers {
  /** Whether Ctrl is held, which inverts the paint direction. */
  readonly isCtrlDown: boolean;
  /**
   * Whether Shift is held: Smooth for Paint Geometry, brush resizing with the
   * right button.
   */
  readonly isShiftDown: boolean;
  /** Whether the right mouse button paints, which inverts the paint direction. */
  readonly isSecondaryButton: boolean;
}

/**
 * Returns whether a press resizes the brush instead of painting.
 *
 * @param modifiers Keys and button of the press.
 * @returns True for Shift with the right mouse button.
 */
export function displacementSculptModifiersResizeIs(modifiers: DisplacementSculptModifiers): boolean {
  return modifiers.isShiftDown && modifiers.isSecondaryButton;
}

/**
 * Returns the settings a paint press uses: Ctrl and the right button each
 * invert Raise (together they cancel out), and Shift turns Paint Geometry into
 * Smooth.
 *
 * @param settings Shared Displacement tab settings.
 * @param modifiers Keys and button of the press.
 * @returns Settings with Raise and the effect resolved for the press.
 */
export function displacementSculptModifiersSettingsApply(
  settings: Readonly<DisplacementSculptSettings>,
  modifiers: DisplacementSculptModifiers,
): Readonly<DisplacementSculptSettings> {
  const isInverted = modifiers.isCtrlDown !== modifiers.isSecondaryButton;
  const isSmoothing = modifiers.isShiftDown && settings.activeTool === 'paint_geometry';
  return {
    ...settings,
    raise: settings.raise !== isInverted,
    effect: isSmoothing ? 'smooth' : settings.effect,
  };
}
