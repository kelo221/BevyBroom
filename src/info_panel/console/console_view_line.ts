import type { ConsoleLogEntry } from '@/info_panel/console/console_log_entry.js';
import { consoleViewLineElementStyle } from '@/info_panel/console/console_view_styles.js';

/**
 * Formats the time of a console line as local hours, minutes and seconds.
 *
 * @param timestampMilliseconds Time in milliseconds since the Unix epoch.
 * @returns Text such as 14:05:09.
 */
export function consoleViewLineTimeFormat(timestampMilliseconds: number): string {
  const time = new Date(timestampMilliseconds);
  const parts = [time.getHours(), time.getMinutes(), time.getSeconds()];
  return parts.map((part) => String(part).padStart(2, '0')).join(':');
}

/**
 * Formats the full text of a console line: its time followed by its message.
 *
 * @param entry Console line.
 * @returns Display text.
 */
export function consoleViewLineTextFormat(entry: ConsoleLogEntry): string {
  return `[${consoleViewLineTimeFormat(entry.timestampMilliseconds)}] ${entry.text}`;
}

/**
 * Creates the element showing one console line.
 *
 * @param entry Console line.
 * @returns Styled line element carrying the level in its data attributes.
 */
export function consoleViewLineElementCreate(entry: ConsoleLogEntry): HTMLElement {
  const lineElement = document.createElement('div');
  lineElement.className = 'editor-console-line';
  lineElement.dataset['level'] = entry.level;
  lineElement.textContent = consoleViewLineTextFormat(entry);
  consoleViewLineElementStyle(lineElement, entry.level);
  return lineElement;
}
