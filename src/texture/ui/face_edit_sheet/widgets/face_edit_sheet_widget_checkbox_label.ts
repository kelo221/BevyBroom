import { Theme } from '@/theme.js';
import type { InputCheckbox } from '@/ui/input/input_checkbox.js';
import { FACE_INSPECTOR_METRICS } from '@/texture/ui/face_inspector/face_inspector_controls.js';

/**
 * Wraps a checkbox and its text into one clickable label.
 *
 * @param checkbox Checkbox shown before the text.
 * @param text Label text.
 * @returns Label element.
 */
export function faceEditSheetCheckboxLabelCreate(checkbox: InputCheckbox, text: string): HTMLLabelElement {
  const label = document.createElement('label');
  label.style.display = 'inline-flex';
  label.style.alignItems = 'center';
  label.style.gap = `${FACE_INSPECTOR_METRICS.gap}px`;
  label.style.fontSize = FACE_INSPECTOR_METRICS.captionFontSize;
  label.style.fontFamily = Theme.uiFontFamily;
  label.style.color = Theme.buttonTextColor;
  label.style.cursor = 'pointer';
  label.style.whiteSpace = 'nowrap';
  const span = document.createElement('span');
  span.textContent = text;
  label.append(checkbox.getElement(), span);
  return label;
}
