import { Theme } from '@/theme.js';
import { BUTTON_CLASSIC_REST_BACKGROUND } from '@/ui/button/button_classic_style.js';

/** Theme roles of modifier stack inspector elements. */
export type ModifierStackUiPaintRole = 'text' | 'button' | 'card' | 'divider' | 'eyeOn' | 'eyeOff' | 'error';

/**
 * Paints the border and face of a framed role: buttons get the classic button
 * face, cards the panel face.
 *
 * @param element Element to paint.
 * @param role Framed theme role.
 */
function modifierStackUiPaintFrame(element: HTMLElement, role: 'button' | 'card'): void {
  element.style.border = `1px solid ${Theme.chromeBorderColor}`;
  element.style.background = role === 'button' ? BUTTON_CLASSIC_REST_BACKGROUND : Theme.panelBackground;
}

/**
 * Returns the text colour of a role.
 *
 * @param role Theme role.
 * @returns CSS colour.
 */
function modifierStackUiPaintTextColor(role: ModifierStackUiPaintRole): string {
  if (role === 'eyeOff') return Theme.disabledTextColor;
  if (role === 'error') return Theme.severityWarningColor;
  return Theme.buttonTextColor;
}

/**
 * Paints an element in the Hammer chrome colours of a theme role.
 *
 * @param element Element to paint.
 * @param role Theme role.
 * @returns The element.
 */
export function modifierStackUiPaint<T extends HTMLElement>(element: T, role: ModifierStackUiPaintRole): T {
  if (role === 'divider') {
    element.style.borderTop = `1px solid ${Theme.chromeBorderColor}`;
    return element;
  }
  if (role === 'button' || role === 'card') modifierStackUiPaintFrame(element, role);
  element.style.color = modifierStackUiPaintTextColor(role);
  return element;
}
