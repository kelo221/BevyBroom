import { Theme } from '@/theme.js';
import { styleFloatingPanelChromeButton } from '@/ui/floating_panel/panel_floating_title_bar.js';

/**
 * Styles a game preview panel button and binds its click handler.
 *
 * @param button Button element.
 * @param title Hover text.
 * @param onClick Click handler.
 */
export function panelGamePreviewButtonPrepare(button: HTMLButtonElement, title: string, onClick: () => void): void {
  button.type = 'button';
  button.title = title;
  styleFloatingPanelChromeButton(button);
  button.style.padding = '3px 10px';
  button.style.fontSize = '12px';
  button.addEventListener('click', onClick);
}

/**
 * Creates a game preview panel button with a label.
 *
 * @param label Button text.
 * @param title Hover text.
 * @param onClick Click handler.
 * @returns The button.
 */
export function panelGamePreviewButtonCreate(label: string, title: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  panelGamePreviewButtonPrepare(button, title, onClick);
  button.textContent = label;
  return button;
}

/**
 * Creates a padded horizontal row of the game preview panel.
 *
 * @returns Row element.
 */
export function panelGamePreviewRowCreate(): HTMLElement {
  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.alignItems = 'center';
  row.style.flexWrap = 'wrap';
  row.style.gap = '6px';
  row.style.padding = '8px 10px 0';
  return row;
}

/**
 * Creates one status line of the game preview panel.
 *
 * @param text Line text.
 * @param isError True to show the line in the error color.
 * @returns Line element.
 */
export function panelGamePreviewLineCreate(text: string, isError: boolean): HTMLElement {
  const line = document.createElement('div');
  line.textContent = text;
  line.style.fontSize = '11px';
  line.style.color = isError ? '#ff7a6a' : Theme.inputTextColor;
  return line;
}
