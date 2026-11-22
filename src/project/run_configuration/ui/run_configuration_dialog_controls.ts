import { Theme } from '@/theme.js';
import { createSettingsSecondaryButton, styleSettingsTextInput } from '@/ui/settings/settings_form_controls.js';
import { dialogChromeCaptionApply } from '@/ui/dialog/dialog_chrome_styles.js';

/** Rows a list box of the Run Configurations dialog shows. */
const RUN_CONFIGURATION_DIALOG_LIST_ROWS = 8;

/** One row of a list box. */
export interface RunConfigurationDialogListRow {
  /** Text of the row. */
  readonly label: string;
  /** Whether the row is drawn dimmed, such as a skipped step. */
  readonly isDimmed: boolean;
}

/**
 * Creates a list box that shows rows and reports the picked row.
 *
 * @param ariaLabel Accessible name.
 * @param rows Rows in order.
 * @param selectedIndex Row shown as selected.
 * @param onSelect Receives the index of a picked row.
 * @returns List box element.
 */
export function runConfigurationDialogListCreate(
  ariaLabel: string,
  rows: readonly RunConfigurationDialogListRow[],
  selectedIndex: number,
  onSelect: (index: number) => void,
): HTMLSelectElement {
  const list = document.createElement('select');
  list.size = RUN_CONFIGURATION_DIALOG_LIST_ROWS;
  list.setAttribute('aria-label', ariaLabel);
  list.style.width = '100%';
  list.style.border = `1px solid ${Theme.inputBorderColor}`;
  list.style.background = Theme.inputBackgroundColor;
  list.style.color = Theme.inputTextColor;
  list.style.fontFamily = Theme.uiFontFamily;
  rows.forEach((row, index) => list.appendChild(runConfigurationDialogListOptionCreate(row, index)));
  list.selectedIndex = rows.length === 0 ? -1 : selectedIndex;
  list.addEventListener('change', () => onSelect(list.selectedIndex));
  return list;
}

/**
 * Creates one row of a list box.
 *
 * @param row Row text and dimming.
 * @param index Row position.
 * @returns Option element.
 */
function runConfigurationDialogListOptionCreate(row: RunConfigurationDialogListRow, index: number): HTMLOptionElement {
  const option = document.createElement('option');
  option.value = String(index);
  option.textContent = row.label;
  if (row.isDimmed) {
    option.style.color = Theme.disabledTextColor;
  }
  return option;
}

/**
 * Creates a row of small buttons.
 *
 * @param buttons Label and action of each button.
 * @returns Row element.
 */
export function runConfigurationDialogButtonRowCreate(
  buttons: readonly { label: string; onClick: () => void }[],
): HTMLElement {
  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.flexWrap = 'wrap';
  row.style.gap = '4px';
  row.style.margin = '4px 0 8px';
  buttons.forEach(({ label, onClick }) => row.appendChild(createSettingsSecondaryButton(label, onClick)));
  return row;
}

/**
 * Creates a caption line above a control.
 *
 * @param text Caption text.
 * @returns Caption element.
 */
export function runConfigurationDialogCaptionCreate(text: string): HTMLElement {
  const caption = document.createElement('div');
  caption.textContent = text;
  dialogChromeCaptionApply(caption);
  return caption;
}

/**
 * Creates a one-line text field that reports its text when it changes.
 *
 * @param ariaLabel Accessible name.
 * @param value Starting text.
 * @param onChange Receives the new text.
 * @returns Text input.
 */
export function runConfigurationDialogTextFieldCreate(
  ariaLabel: string,
  value: string,
  onChange: (value: string) => void,
): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'text';
  input.value = value;
  input.setAttribute('aria-label', ariaLabel);
  styleSettingsTextInput(input);
  input.addEventListener('change', () => onChange(input.value));
  return input;
}

/**
 * Creates a text area with one entry per line that reports the entries when it
 * changes; empty lines are dropped.
 *
 * @param ariaLabel Accessible name.
 * @param values Starting entries.
 * @param onChange Receives the new entries.
 * @returns Text area.
 */
export function runConfigurationDialogTextListFieldCreate(
  ariaLabel: string,
  values: readonly string[],
  onChange: (values: string[]) => void,
): HTMLTextAreaElement {
  const area = document.createElement('textarea');
  area.rows = 4;
  area.value = values.join('\n');
  area.setAttribute('aria-label', ariaLabel);
  styleSettingsTextInput(area);
  area.style.fontFamily = 'monospace';
  area.style.resize = 'vertical';
  area.addEventListener('change', () => onChange(area.value.split('\n').filter((line) => line.trim() !== '')));
  return area;
}
