import { Theme } from '@/theme.js';
import { hexToRgb } from '@/utils/utils_color.js';

/**
 * Styles the scrolling area holding the issue table.
 *
 * @param scrollElement Scrolling container.
 */
export function issuesViewScrollElementStyle(scrollElement: HTMLElement): void {
  scrollElement.style.flex = '1 1 auto';
  scrollElement.style.minHeight = '0';
  scrollElement.style.overflow = 'auto';
}

/**
 * Styles the issue table to fill the width with fixed columns.
 *
 * @param tableElement Table element.
 */
export function issuesViewTableStyle(tableElement: HTMLTableElement): void {
  tableElement.style.width = '100%';
  tableElement.style.borderCollapse = 'collapse';
  tableElement.style.tableLayout = 'fixed';
  tableElement.style.fontFamily = Theme.uiFontFamily;
  tableElement.style.fontSize = '12px';
}

/**
 * Styles one header cell of the issue table.
 *
 * @param headerCell Header cell.
 * @param widthCss CSS width of the column, or empty to take the rest.
 */
export function issuesViewHeaderCellStyle(headerCell: HTMLTableCellElement, widthCss: string): void {
  headerCell.style.position = 'sticky';
  headerCell.style.top = '0';
  headerCell.style.width = widthCss;
  headerCell.style.textAlign = 'left';
  headerCell.style.fontWeight = '600';
  headerCell.style.padding = '4px 8px';
  headerCell.style.background = hexToRgb(Theme.toolbarBackground);
  headerCell.style.borderBottom = `1px solid ${Theme.statusBarBorderColor}`;
  headerCell.style.color = Theme.buttonTextColor;
}

/**
 * Styles one body cell of the issue table so text stays on one line.
 *
 * @param cell Body cell.
 */
export function issuesViewBodyCellStyle(cell: HTMLTableCellElement): void {
  cell.style.padding = '3px 8px';
  cell.style.whiteSpace = 'nowrap';
  cell.style.overflow = 'hidden';
  cell.style.textOverflow = 'ellipsis';
}

/**
 * Styles an issue row as clickable.
 *
 * @param rowElement Row element.
 */
export function issuesViewRowStyle(rowElement: HTMLTableRowElement): void {
  rowElement.style.cursor = 'pointer';
  rowElement.style.background = 'transparent';
}

/**
 * Styles the severity mark in front of an object name.
 *
 * @param markElement Mark element.
 * @param color CSS color of the severity.
 */
export function issuesViewSeverityMarkStyle(markElement: HTMLElement, color: string): void {
  markElement.style.display = 'inline-block';
  markElement.style.width = '14px';
  markElement.style.marginRight = '6px';
  markElement.style.textAlign = 'center';
  markElement.style.color = color;
}

/**
 * Styles the text shown when there are no issues.
 *
 * @param emptyElement Empty state element.
 */
export function issuesViewEmptyStyle(emptyElement: HTMLElement): void {
  emptyElement.style.padding = '8px 10px';
  emptyElement.style.fontFamily = Theme.uiFontFamily;
  emptyElement.style.fontSize = '12px';
  emptyElement.style.color = Theme.statusBarTextColor;
}
