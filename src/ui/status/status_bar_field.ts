import { Theme } from '@/theme.js';

/**
 * Creates one sunken Hammer-style status bar field.
 *
 * @param className CSS class identifying the field.
 * @param flex CSS flex value: grows for the help field, fixed for readouts.
 * @returns Field element.
 */
export function statusBarFieldCreate(className: string, flex: string): HTMLElement {
  const field = document.createElement('span');
  field.classList.add('status-bar-field', className);
  field.style.flex = flex;
  field.style.minWidth = '0';
  field.style.height = `${Theme.statusBarHeightPx - 2}px`;
  field.style.lineHeight = `${Theme.statusBarHeightPx - 2}px`;
  field.style.padding = '0 4px';
  field.style.boxSizing = 'border-box';
  field.style.borderTop = `1px solid ${Theme.chromeBevelDark}`;
  field.style.borderLeft = `1px solid ${Theme.chromeBevelDark}`;
  field.style.borderBottom = `1px solid ${Theme.chromeBevelLight}`;
  field.style.borderRight = `1px solid ${Theme.chromeBevelLight}`;
  field.style.overflow = 'hidden';
  field.style.textOverflow = 'ellipsis';
  field.style.whiteSpace = 'nowrap';
  field.style.fontFamily = Theme.uiFontFamily;
  field.style.fontSize = `${Theme.uiFontSizePx}px`;
  field.style.color = Theme.statusBarTextColor;
  return field;
}
