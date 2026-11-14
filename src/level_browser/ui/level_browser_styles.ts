import { Theme } from '@/theme.js';
import { hexToRgb } from '@/utils/utils_color.js';

/**
 * Styles the browser root: a column with the message line, the list and the
 * controls row.
 *
 * @param root Root element.
 */
export function levelBrowserStyleRoot(root: HTMLElement): void {
  root.style.display = 'flex';
  root.style.flexDirection = 'column';
  root.style.minHeight = '0';
  root.style.height = '100%';
  root.style.boxSizing = 'border-box';
  root.style.background = hexToRgb(Theme.propertiesPanelBackground);
  root.style.color = Theme.buttonTextColor;
  root.style.fontFamily = Theme.uiFontFamily;
  root.style.fontSize = `${Theme.uiFontSizePx}px`;
}

/**
 * Styles the line above the list that names the project or explains why no
 * levels are listed.
 *
 * @param message Message element.
 */
export function levelBrowserStyleMessage(message: HTMLElement): void {
  message.style.flex = '0 0 auto';
  message.style.padding = '4px 8px';
  message.style.borderBottom = `1px solid ${Theme.statusBarBorderColor}`;
  message.style.color = Theme.secondaryTextColor;
  message.style.fontSize = '11px';
  message.style.whiteSpace = 'pre-wrap';
}

/**
 * Styles the scrollable, focusable list of levels.
 *
 * @param list List element.
 */
export function levelBrowserStyleList(list: HTMLElement): void {
  list.style.flex = '1 1 auto';
  list.style.minHeight = '0';
  list.style.overflowY = 'auto';
  list.style.background = Theme.inputBackgroundColor;
  list.style.outline = 'none';
}

/**
 * Styles one level row: the name on the first line, the id and document on the
 * second, the modified time on the right.
 *
 * @param row Row element.
 */
export function levelBrowserStyleRow(row: HTMLElement): void {
  row.style.display = 'grid';
  row.style.gridTemplateColumns = 'minmax(0, 1fr) auto';
  row.style.columnGap = '8px';
  row.style.alignItems = 'center';
  row.style.padding = '3px 8px';
  row.style.cursor = 'default';
  row.style.userSelect = 'none';
  row.style.borderBottom = `1px solid ${Theme.tableGridLineColor}`;
  levelBrowserStyleRowSelected(row, false);
}

/**
 * Shows or hides the selection highlight of a row.
 *
 * @param row Row element.
 * @param isSelected True for the selected row.
 */
export function levelBrowserStyleRowSelected(row: HTMLElement, isSelected: boolean): void {
  row.style.background = isSelected ? Theme.listSelectedBackground : 'transparent';
  row.style.outline = isSelected ? `1px solid ${Theme.listSelectedBorder}` : 'none';
  row.style.outlineOffset = '-1px';
}

/**
 * Styles the level name of a row; the open level is shown bold.
 *
 * @param name Name element.
 * @param isOpen True for the level the open scene belongs to.
 */
export function levelBrowserStyleRowName(name: HTMLElement, isOpen: boolean): void {
  name.style.overflow = 'hidden';
  name.style.textOverflow = 'ellipsis';
  name.style.whiteSpace = 'nowrap';
  name.style.fontWeight = isOpen ? '700' : '400';
}

/**
 * Styles the secondary line of a row.
 *
 * @param detail Detail element.
 */
export function levelBrowserStyleRowDetail(detail: HTMLElement): void {
  detail.style.overflow = 'hidden';
  detail.style.textOverflow = 'ellipsis';
  detail.style.whiteSpace = 'nowrap';
  detail.style.color = Theme.secondaryTextColor;
  detail.style.fontSize = '10px';
}

/**
 * Styles the modified time of a row.
 *
 * @param modified Modified time element.
 */
export function levelBrowserStyleRowModified(modified: HTMLElement): void {
  modified.style.gridRow = '1 / span 2';
  modified.style.gridColumn = '2';
  modified.style.color = Theme.secondaryTextColor;
  modified.style.fontSize = '10px';
  modified.style.fontFamily = Theme.monospaceFontFamily;
  modified.style.whiteSpace = 'nowrap';
}

/**
 * Styles the controls row under the list.
 *
 * @param row Controls row element.
 */
export function levelBrowserStyleControlsRow(row: HTMLElement): void {
  row.style.display = 'flex';
  row.style.flexWrap = 'wrap';
  row.style.alignItems = 'center';
  row.style.gap = '4px';
  row.style.padding = '4px 6px';
  row.style.borderTop = `1px solid ${Theme.statusBarBorderColor}`;
  row.style.background = hexToRgb(Theme.toolbarBackgroundEnd);
  row.style.flex = '0 0 auto';
}
