import { Theme } from '@/theme.js';

/** Any field that exposes its root element. */
export interface PanelPropertiesRowField {
  getElement(): HTMLElement;
}

/** Data attribute key holding the caption of a labeled field row. */
export const PANEL_PROPERTIES_ROW_DATASET_KEY = 'propertiesRow';

/** Data attribute key holding the help text of a labeled field row. */
export const PANEL_PROPERTIES_ROW_HELP_DATASET_KEY = 'propertiesRowHelp';

/** Data attribute key marking a row that names a group of field rows. */
export const PANEL_PROPERTIES_GROUP_ROW_DATASET_KEY = 'propertiesGroupRow';

/** CSS custom property holding how far a row is indented under its groups. */
export const PANEL_PROPERTIES_ROW_INDENT_PROPERTY = '--properties-row-indent';

/** Indentation of one group nesting level in pixels. */
export const PANEL_PROPERTIES_ROW_INDENT_STEP_PX = 10;

/**
 * Records how deep a row sits under its groups, so hosts such as a keyvalue
 * table can indent its caption.
 *
 * @param row Field or group row element.
 * @param depth Group nesting depth; 0 for top-level rows.
 */
export function panelPropertiesRowIndentWrite(row: HTMLElement, depth: number): void {
  row.style.setProperty(PANEL_PROPERTIES_ROW_INDENT_PROPERTY, `${depth * PANEL_PROPERTIES_ROW_INDENT_STEP_PX}px`);
}

/**
 * Marks an element as a group row that names the field rows after it, so hosts
 * such as a keyvalue table can present every group the same way.
 *
 * @param row Group row element.
 */
export function panelPropertiesGroupRowMark(row: HTMLElement): void {
  row.dataset[PANEL_PROPERTIES_GROUP_ROW_DATASET_KEY] = 'true';
}

/**
 * Marks an element as a labeled field row, so hosts such as a keyvalue table
 * can find and present every row the same way.
 *
 * @param row Row element.
 * @param labelText Row caption.
 * @param helpText Description of the field, or empty when there is none.
 */
export function panelPropertiesRowMark(row: HTMLElement, labelText: string, helpText: string): void {
  row.dataset[PANEL_PROPERTIES_ROW_DATASET_KEY] = labelText;
  if (helpText !== '') {
    row.dataset[PANEL_PROPERTIES_ROW_HELP_DATASET_KEY] = helpText;
  }
}

/**
 * Builds one labeled inspector row with the field stretched beside its caption.
 *
 * @param labelText Row caption.
 * @param field Field that exposes its element.
 * @returns Row element.
 */
export function panelPropertiesRowCreate(labelText: string, field: PanelPropertiesRowField): HTMLElement {
  const row = document.createElement('div');
  panelPropertiesRowMark(row, labelText, '');
  row.style.display = 'flex';
  row.style.alignItems = 'center';
  row.style.gap = '4px';
  row.style.padding = '0 8px 8px';
  row.appendChild(panelPropertiesRowLabelCreate(labelText));
  row.appendChild(panelPropertiesRowFieldStretch(field.getElement()));
  return row;
}

/**
 * Creates a fixed-width row caption.
 *
 * @param labelText Row caption.
 * @returns Caption element.
 */
export function panelPropertiesRowLabelCreate(labelText: string): HTMLElement {
  const label = document.createElement('span');
  label.textContent = labelText;
  label.style.width = '9ch';
  label.style.flexShrink = '0';
  panelPropertiesRowCaptionPaint(label);
  return label;
}

/**
 * Paints a caption with the inspector caption color and size in a font.
 *
 * @param label Caption element.
 * @param fontFamily CSS font family; the inspector's monospace by default.
 */
export function panelPropertiesRowCaptionPaint(label: HTMLElement, fontFamily: string = 'monospace'): void {
  label.style.color = Theme.buttonTextColor;
  label.style.fontFamily = fontFamily;
  label.style.fontSize = '12px';
}

/**
 * Lets a field use the width left beside its caption.
 *
 * @param field Input element.
 * @returns The same element.
 */
export function panelPropertiesRowFieldStretch(field: HTMLElement): HTMLElement {
  field.style.flex = '1';
  field.style.minWidth = '0';
  field.style.width = '100%';
  field.style.maxWidth = 'none';
  return field;
}
