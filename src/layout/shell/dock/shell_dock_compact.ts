import { Theme } from '@/theme.js';
import { buttonCompactCreate } from '@/ui/button/button_compact.js';

/** Gap between compact dock controls and rows in CSS pixels. */
export const SHELL_DOCK_COMPACT_GAP_PX = 4;

/**
 * Width below which a compact dock field moves onto its own line, in CSS
 * pixels.
 */
export const SHELL_DOCK_COMPACT_FIELD_BASIS_PX = 96;

/** CSS class every compact dock button and field carries. */
export const SHELL_DOCK_COMPACT_CONTROL_CLASS = 'shell-dock-compact-control';

/**
 * Creates a compact dock button whose label is cut with an ellipsis when the
 * dock is too narrow, keeping the full label as its tooltip.
 *
 * @param label Button text and tooltip.
 * @param onClick Click handler.
 * @returns Button element.
 */
export function shellDockCompactButtonCreate(label: string, onClick: () => void): HTMLButtonElement {
  const button = buttonCompactCreate({ title: label, widthPx: null, heightPx: Theme.dockControlHeightPx, onClick });
  shellDockCompactButtonStyle(button);
  return button;
}

/**
 * Gives a button the compact dock height and font, lets it shrink with an
 * ellipsis and gives it its label as tooltip when it has none.
 *
 * @param button Button element.
 */
export function shellDockCompactButtonStyle(button: HTMLButtonElement): void {
  shellDockCompactControlSizeApply(button);
  button.style.flex = '1 1 auto';
  button.style.display = 'block';
  button.style.padding = '0 4px';
  button.style.lineHeight = `${Theme.dockControlHeightPx - 2}px`;
  button.style.textAlign = 'center';
  button.style.textOverflow = 'ellipsis';
  button.style.whiteSpace = 'nowrap';
  button.style.overflow = 'hidden';
  if (button.title === '') {
    button.title = button.textContent ?? '';
  }
}

/**
 * Gives a text field or drop-down the compact dock height and font and lets it
 * move onto its own line when its row is too narrow.
 *
 * @param field Input or select element.
 */
export function shellDockCompactFieldStyle(field: HTMLInputElement | HTMLSelectElement): void {
  shellDockCompactControlSizeApply(field);
  field.style.flex = `1 1 ${SHELL_DOCK_COMPACT_FIELD_BASIS_PX}px`;
}

/**
 * Lays a dock row out as a wrapping line of compact controls.
 *
 * @param row Row element.
 */
export function shellDockCompactRowStyle(row: HTMLElement): void {
  row.style.display = 'flex';
  row.style.flexWrap = 'wrap';
  row.style.alignItems = 'center';
  row.style.gap = `${SHELL_DOCK_COMPACT_GAP_PX}px`;
  row.style.minWidth = '0';
}

/**
 * Applies the size, font and shrink limits shared by compact buttons and
 * fields.
 *
 * @param control Button, input or select element.
 */
function shellDockCompactControlSizeApply(control: HTMLElement): void {
  control.classList.add(SHELL_DOCK_COMPACT_CONTROL_CLASS);
  control.style.boxSizing = 'border-box';
  control.style.height = `${Theme.dockControlHeightPx}px`;
  control.style.minWidth = '0';
  control.style.maxWidth = '100%';
  control.style.fontFamily = Theme.uiFontFamily;
  control.style.fontSize = `${Theme.uiFontSizePx}px`;
}
