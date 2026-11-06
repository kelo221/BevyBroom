import { Theme } from '@/theme.js';
import { hexToRgb } from '@/utils/utils_color.js';
import { buttonClassicPrimaryApply, buttonClassicStyleApply } from '@/ui/button/button_classic_style.js';

/**
 * Applies classic Windows dialog chrome to a modal dialog panel: light face,
 * thin grey border, soft shadow and black chrome text.
 *
 * @param root Dialog panel element.
 * @param minWidthPx Minimum panel width in pixels.
 * @param maxWidthPx Maximum panel width in pixels.
 */
export function dialogChromePanelApply(root: HTMLElement, minWidthPx: number, maxWidthPx: number): void {
  root.style.minWidth = `${minWidthPx}px`;
  root.style.maxWidth = `${maxWidthPx}px`;
  root.style.padding = '14px 16px 12px';
  root.style.borderRadius = '2px';
  root.style.background = hexToRgb(Theme.propertiesPanelBackground);
  root.style.border = `1px solid ${Theme.chromeBorderColor}`;
  root.style.boxShadow = Theme.dialogShadow;
  root.style.color = Theme.buttonTextColor;
  root.style.boxSizing = 'border-box';
  root.style.fontFamily = Theme.uiFontFamily;
  root.style.fontSize = `${Theme.uiFontSizePx}px`;
}

/**
 * Applies the heading style of a dialog title.
 *
 * @param title Title element.
 */
export function dialogChromeTitleApply(title: HTMLElement): void {
  title.style.margin = '0 0 10px';
  title.style.fontSize = `${Theme.uiFontSizePx + 3}px`;
  title.style.fontWeight = '600';
  title.style.color = Theme.buttonTextColor;
}

/**
 * Applies the body text style of a dialog paragraph.
 *
 * @param paragraph Paragraph element.
 * @param isEmphasized True for bold primary text, false for regular text.
 */
export function dialogChromeBodyTextApply(paragraph: HTMLElement, isEmphasized: boolean): void {
  paragraph.style.fontSize = `${Theme.uiFontSizePx + 1}px`;
  paragraph.style.lineHeight = '1.45';
  paragraph.style.color = Theme.buttonTextColor;
  paragraph.style.fontWeight = isEmphasized ? '700' : '400';
}

/**
 * Applies the style of a small caption above a dialog field.
 *
 * @param caption Caption element.
 */
export function dialogChromeCaptionApply(caption: HTMLElement): void {
  caption.style.fontSize = `${Theme.uiFontSizePx}px`;
  caption.style.fontWeight = '600';
  caption.style.color = Theme.secondaryTextColor;
  caption.style.marginBottom = '4px';
}

/**
 * Applies the white sunken look of a read-only monospace dialog field.
 *
 * @param field Input element.
 */
export function dialogChromeReadonlyFieldApply(field: HTMLInputElement): void {
  field.style.width = '100%';
  field.style.boxSizing = 'border-box';
  field.style.padding = '4px 6px';
  field.style.borderRadius = '0';
  field.style.border = `1px solid ${Theme.inputBorderColor}`;
  field.style.background = Theme.inputBackgroundColor;
  field.style.color = Theme.inputTextColor;
  field.style.fontFamily = Theme.monospaceFontFamily;
  field.style.fontSize = `${Theme.uiFontSizePx + 1}px`;
}

/**
 * Applies classic push-button chrome to a dialog action button; the primary
 * (default) action gets the accent border.
 *
 * @param button Button element.
 * @param isPrimary True for the default action.
 */
export function dialogChromeActionButtonApply(button: HTMLButtonElement, isPrimary: boolean): void {
  buttonClassicStyleApply(button);
  button.style.minWidth = '75px';
  button.style.padding = '4px 12px';
  if (isPrimary) {
    buttonClassicPrimaryApply(button);
  }
}
