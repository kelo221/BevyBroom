import { Theme } from '@/theme.js';

/** Any field that exposes its root element. */
export interface PanelPropertiesRowField {
  getElement(): HTMLElement;
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
 * Paints a caption with the inspector caption font and color.
 *
 * @param label Caption element.
 */
export function panelPropertiesRowCaptionPaint(label: HTMLElement): void {
  label.style.color = Theme.buttonTextColor;
  label.style.fontFamily = 'monospace';
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
