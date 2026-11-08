import { panelPropertiesRowCaptionPaint } from '@/ui/properties/panel_properties_row.js';

/**
 * Lays out elements side by side in one wrapping row.
 *
 * @param elements Row children.
 * @returns Row element.
 */
export function formLayoutRowCreate(elements: readonly HTMLElement[]): HTMLElement {
  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.flexWrap = 'wrap';
  row.style.alignItems = 'center';
  row.style.gap = '4px';
  row.append(...elements);
  return row;
}

/**
 * Lays out cells in a grid with the given column sizes, filling row by row.
 * Null cells stay empty.
 *
 * @param columnTemplate CSS grid-template-columns value.
 * @param cells Grid cells in row order.
 * @returns Grid element.
 */
export function formLayoutGridCreate(columnTemplate: string, cells: readonly (HTMLElement | null)[]): HTMLElement {
  const grid = document.createElement('div');
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = columnTemplate;
  grid.style.gap = '3px';
  grid.append(...cells.map((cell) => cell ?? document.createElement('span')));
  return grid;
}

/**
 * Lays out cells in a grid of equally wide columns, filling row by row. Null
 * cells stay empty.
 *
 * @param columnCount Number of columns.
 * @param cells Grid cells in row order.
 * @returns Grid element.
 */
export function formLayoutGridEqualColumnsCreate(
  columnCount: number,
  cells: readonly (HTMLElement | null)[],
): HTMLElement {
  return formLayoutGridCreate(`repeat(${columnCount}, minmax(0, 1fr))`, cells);
}

/**
 * Creates a short caption placed in front of a field inside a row.
 *
 * @param text Caption text.
 * @param fontFamily CSS font family; the inspector's monospace by default.
 * @returns Caption element.
 */
export function formLayoutFieldLabelCreate(text: string, fontFamily: string = 'monospace'): HTMLElement {
  const label = document.createElement('span');
  label.textContent = text;
  panelPropertiesRowCaptionPaint(label, fontFamily);
  label.style.fontSize = '11px';
  return label;
}
