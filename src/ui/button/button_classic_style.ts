import { Theme } from '@/theme.js';
import { hexToRgb } from '@/utils/utils_color.js';

/** Background of a classic button at rest. */
export const BUTTON_CLASSIC_REST_BACKGROUND = hexToRgb(Theme.buttonBackground);

/** Background of a classic button under the pointer. */
export const BUTTON_CLASSIC_HOVER_BACKGROUND = hexToRgb(Theme.buttonHoverColor);

/**
 * Applies the classic Windows look to a button: light face, thin grey border,
 * black text in the chrome font.
 *
 * @param button Button element to style.
 */
export function buttonClassicStyleApply(button: HTMLElement): void {
  button.style.border = `1px solid ${Theme.chromeBorderColor}`;
  button.style.borderRadius = `${Theme.controlRadiusPx}px`;
  button.style.background = BUTTON_CLASSIC_REST_BACKGROUND;
  button.style.color = Theme.buttonTextColor;
  button.style.fontFamily = Theme.uiFontFamily;
  button.style.fontSize = `${Theme.uiFontSizePx}px`;
  button.style.cursor = 'pointer';
}

/**
 * Marks a classic button as the default action with the accent border.
 *
 * @param button Button element to style.
 */
export function buttonClassicPrimaryApply(button: HTMLElement): void {
  button.style.border = `1px solid ${Theme.toggleActiveBorder}`;
}

/**
 * Shows a classic button as pressed (toggled on) or released.
 *
 * @param button Button element to style.
 * @param isPressed True to show the pressed face and accent border.
 */
export function buttonClassicPressedApply(button: HTMLElement, isPressed: boolean): void {
  button.style.background = buttonClassicRestingBackgroundRead(isPressed);
  button.style.borderColor = isPressed ? Theme.toggleActiveBorder : Theme.chromeBorderColor;
  button.style.color = Theme.buttonTextColor;
}

/**
 * Returns the background a classic button shows while the pointer is away.
 *
 * @param isPressed True while the button is toggled on.
 * @returns CSS background.
 */
export function buttonClassicRestingBackgroundRead(isPressed: boolean): string {
  return isPressed ? Theme.buttonPressedBackground : BUTTON_CLASSIC_REST_BACKGROUND;
}

/**
 * Returns the background a classic button shows while the pointer is over it.
 *
 * @param isPressed True while the button is toggled on.
 * @returns CSS background.
 */
export function buttonClassicHoverBackgroundRead(isPressed: boolean): string {
  return isPressed ? Theme.buttonPressedBackground : BUTTON_CLASSIC_HOVER_BACKGROUND;
}

/**
 * Lightens a classic button while the pointer is over it and restores the face
 * of its current state when the pointer leaves.
 *
 * @param button Button element.
 * @param isPressedRead Returns whether the button is currently toggled on.
 */
export function buttonClassicHoverBind(button: HTMLElement, isPressedRead: () => boolean): void {
  button.addEventListener('mouseenter', () => {
    button.style.background = buttonClassicHoverBackgroundRead(isPressedRead());
  });
  button.addEventListener('mouseleave', () => {
    button.style.background = buttonClassicRestingBackgroundRead(isPressedRead());
  });
}
