import { Theme } from '@/theme.js';
import {
  buttonClassicHoverBind,
  buttonClassicPressedApply,
  buttonClassicRestingBackgroundRead,
  buttonClassicStyleApply,
} from './button_classic_style.js';

/** Font size of the text inside a compact button. */
export const BUTTON_COMPACT_FONT_SIZE = `${Theme.uiFontSizePx}px`;

/** Line height, as a multiple of the font size, of wrapping compact button text. */
export const BUTTON_COMPACT_WRAPPED_LINE_HEIGHT = '1.2';

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
  buttonClassicHoverBind(button, () => buttonCompactActiveRead(button));
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
 * Shows a compact button as active (on, or already satisfied) with the pressed
 * face and accent border, or as idle with the neutral face. The pointer leaving
 * the button restores this state.
 *
 * @param button Compact button.
 * @param isActive True to show the pressed state.
 */
export function buttonCompactActiveWrite(button: HTMLButtonElement, isActive: boolean): void {
  button.dataset[BUTTON_COMPACT_ACTIVE_DATASET_KEY] = isActive ? 'true' : 'false';
  buttonClassicPressedApply(button, isActive);
}

/**
 * Reads whether a compact button is shown as active.
 *
 * @param button Compact button.
 * @returns True while the button shows the pressed state.
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
  return buttonClassicRestingBackgroundRead(buttonCompactActiveRead(button));
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
 * Applies the classic border, colors and font of a compact button.
 *
 * @param button Button element.
 */
function buttonCompactColorsApply(button: HTMLButtonElement): void {
  buttonClassicStyleApply(button);
  button.style.fontSize = BUTTON_COMPACT_FONT_SIZE;
  button.style.lineHeight = '1';
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
