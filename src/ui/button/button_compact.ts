import { Theme } from '@/theme.js';
import { hexToRgb } from '@/utils/utils_color.js';

/** Font size of the text inside a compact button. */
export const BUTTON_COMPACT_FONT_SIZE = '11px';

/** Line height, as a multiple of the font size, of wrapping compact button text. */
export const BUTTON_COMPACT_WRAPPED_LINE_HEIGHT = '1.2';

/** Background tint of a compact button in its active (on or satisfied) state. */
export const BUTTON_COMPACT_ACTIVE_BACKGROUND = 'rgba(232, 106, 23, 0.22)';

/** Background tint of an active compact button while the pointer is over it. */
const BUTTON_COMPACT_ACTIVE_HOVER_BACKGROUND = 'rgba(232, 106, 23, 0.32)';

/** Dataset key that marks a compact button as active. */
const BUTTON_COMPACT_ACTIVE_DATASET_KEY = 'buttonCompactActive';

/** Content and size of one compact button. */
export interface ButtonCompactOptions {
  /** Accessible name and tooltip. */
  title: string;
  /** Visible text label, when the button shows text. */
  text?: string;
  /** SVG markup, when the button shows an icon. */
  svgIcon?: string;
  /** Fixed width in pixels, or null to size to the content. */
  widthPx: number | null;
  /** Height in pixels. */
  heightPx: number;
  /**
   * True to wrap text that does not fit onto centered lines instead of keeping
   * one line; off when omitted.
   */
  isTextWrapping?: boolean;
  /** Click handler. */
  onClick: () => void;
}

/**
 * Creates a themed compact button with hover feedback whose clicks do not
 * bubble to the surrounding element.
 *
 * @param options Button content, size and click handler.
 * @returns Button element.
 */
export function buttonCompactCreate(options: ButtonCompactOptions): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.title = options.title;
  button.setAttribute('aria-label', options.title);
  buttonCompactContentWrite(button, options);
  buttonCompactSizeApply(button, options.widthPx, options.heightPx);
  buttonCompactColorsApply(button);
  if (options.isTextWrapping === true) {
    buttonCompactTextWrapApply(button);
  }
  buttonCompactHoverBind(button);
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    options.onClick();
  });
  return button;
}

/**
 * Enables or disables a compact button and dims it while disabled.
 *
 * @param button Compact button.
 * @param isEnabled True to accept clicks.
 */
export function buttonCompactEnabledWrite(button: HTMLButtonElement, isEnabled: boolean): void {
  button.disabled = !isEnabled;
  button.style.opacity = isEnabled ? '1' : '0.45';
  button.style.cursor = isEnabled ? 'pointer' : 'default';
}

/**
 * Shows a compact button as active (on, or already satisfied) with a subtle
 * orange tint, or as idle with the neutral background. The pointer leaving the
 * button restores this state.
 *
 * @param button Compact button.
 * @param isActive True to show the active tint.
 */
export function buttonCompactActiveWrite(button: HTMLButtonElement, isActive: boolean): void {
  button.dataset[BUTTON_COMPACT_ACTIVE_DATASET_KEY] = isActive ? 'true' : 'false';
  button.style.color = isActive ? '#ffffff' : Theme.buttonTextColor;
  button.style.background = buttonCompactRestingBackgroundRead(button);
}

/**
 * Reads whether a compact button is shown as active.
 *
 * @param button Compact button.
 * @returns True while the button shows the active tint.
 */
export function buttonCompactActiveRead(button: HTMLButtonElement): boolean {
  return button.dataset[BUTTON_COMPACT_ACTIVE_DATASET_KEY] === 'true';
}

/**
 * Reads the background a compact button shows while the pointer is away.
 *
 * @param button Compact button.
 * @returns CSS background of the current state.
 */
export function buttonCompactRestingBackgroundRead(button: HTMLButtonElement): string {
  return buttonCompactActiveRead(button) ? BUTTON_COMPACT_ACTIVE_BACKGROUND : hexToRgb(Theme.buttonBackground);
}

/**
 * Reads the background a compact button shows while the pointer is over it.
 *
 * @param button Compact button.
 * @returns CSS background of the hovered current state.
 */
function buttonCompactHoverBackgroundRead(button: HTMLButtonElement): string {
  return buttonCompactActiveRead(button) ? BUTTON_COMPACT_ACTIVE_HOVER_BACKGROUND : hexToRgb(Theme.buttonHoverColor);
}

/**
 * Writes the text or icon content of a compact button.
 *
 * @param button Button element.
 * @param options Button content options.
 */
function buttonCompactContentWrite(button: HTMLButtonElement, options: ButtonCompactOptions): void {
  if (options.svgIcon !== undefined) {
    button.innerHTML = options.svgIcon;
    return;
  }
  button.textContent = options.text ?? options.title;
}

/**
 * Applies the box size and content alignment of a compact button. The button
 * never grows or shrinks inside a flex row or column.
 *
 * @param button Button element.
 * @param widthPx Fixed width in pixels, or null to size to the content.
 * @param heightPx Height in pixels.
 */
function buttonCompactSizeApply(button: HTMLButtonElement, widthPx: number | null, heightPx: number): void {
  if (widthPx !== null) {
    button.style.width = `${widthPx}px`;
  }
  button.style.flex = '0 0 auto';
  button.style.height = `${heightPx}px`;
  button.style.boxSizing = 'border-box';
  button.style.display = 'inline-flex';
  button.style.alignItems = 'center';
  button.style.justifyContent = 'center';
  button.style.padding = widthPx === null ? '0 8px' : '0';
  button.style.whiteSpace = 'nowrap';
}

/**
 * Applies the border, colors and font of a compact button.
 *
 * @param button Button element.
 */
function buttonCompactColorsApply(button: HTMLButtonElement): void {
  button.style.border = `1px solid ${Theme.inputBorderColor}`;
  button.style.borderRadius = '2px';
  button.style.background = hexToRgb(Theme.buttonBackground);
  button.style.color = Theme.buttonTextColor;
  button.style.fontFamily = Theme.uiFontFamily;
  button.style.fontSize = BUTTON_COMPACT_FONT_SIZE;
  button.style.lineHeight = '1';
  button.style.cursor = 'pointer';
  button.style.overflow = 'hidden';
}

/**
 * Lets the text of a compact button wrap at spaces, and inside words too long
 * for one line, onto centered lines spaced for reading.
 *
 * @param button Button element.
 */
function buttonCompactTextWrapApply(button: HTMLButtonElement): void {
  button.style.whiteSpace = 'normal';
  button.style.overflowWrap = 'break-word';
  button.style.textAlign = 'center';
  button.style.lineHeight = BUTTON_COMPACT_WRAPPED_LINE_HEIGHT;
}

/**
 * Lightens a compact button's background while the pointer is over it and
 * restores the background of its current state when the pointer leaves.
 *
 * @param button Button element.
 */
function buttonCompactHoverBind(button: HTMLButtonElement): void {
  button.addEventListener('mouseenter', () => {
    button.style.background = buttonCompactHoverBackgroundRead(button);
  });
  button.addEventListener('mouseleave', () => {
    button.style.background = buttonCompactRestingBackgroundRead(button);
  });
}
