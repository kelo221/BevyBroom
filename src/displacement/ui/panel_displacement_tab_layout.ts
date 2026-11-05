import { Theme } from '@/theme.js';
import { panelPropertiesRowCaptionPaint } from '@/ui/properties/panel_properties_row.js';

/**
 * Lays out elements side by side in one wrapping row.
 *
 * @param elements Row children.
 * @returns Row element.
 */
export function displacementTabRowCreate(elements: readonly HTMLElement[]): HTMLElement {
  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.flexWrap = 'wrap';
  row.style.alignItems = 'center';
  row.style.gap = '4px';
  row.append(...elements);
  return row;
}

/**
 * Creates a group caption painted like inspector captions.
 *
 * @param text Caption text.
 * @returns Caption element.
 */
export function displacementTabCaptionCreate(text: string): HTMLElement {
  const caption = document.createElement('div');
  caption.textContent = text;
  panelPropertiesRowCaptionPaint(caption);
  caption.style.color = Theme.statusBarTextColor;
  caption.style.marginTop = '4px';
  return caption;
}

/**
 * Creates a short caption placed in front of a field inside a row.
 *
 * @param text Caption text.
 * @returns Caption element.
 */
export function displacementTabFieldLabelCreate(text: string): HTMLElement {
  const label = document.createElement('span');
  label.textContent = text;
  panelPropertiesRowCaptionPaint(label);
  label.style.fontSize = '11px';
  return label;
}

/**
 * Wraps a checkbox with a clickable caption.
 *
 * @param checkbox Checkbox element.
 * @param text Caption text.
 * @returns Label element.
 */
export function displacementTabCheckboxLabelCreate(checkbox: HTMLInputElement, text: string): HTMLLabelElement {
  const label = document.createElement('label');
  label.style.display = 'inline-flex';
  label.style.alignItems = 'center';
  label.style.gap = '4px';
  label.append(checkbox, displacementTabFieldLabelCreate(text));
  return label;
}
