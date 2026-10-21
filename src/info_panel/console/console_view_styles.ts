import { infoPanelSeverityColorRead } from '@/info_panel/info_panel_severity.js';
import type { ConsoleLogLevel } from '@/info_panel/console/console_log_entry.js';

/** Fixed-width font of the console lines. */
export const CONSOLE_VIEW_FONT_FAMILY = 'Consolas, "Cascadia Mono", "Courier New", monospace';

/**
 * Styles the scrolling area holding the console lines: read-only, fixed-width
 * and without wrapping so long lines scroll sideways.
 *
 * @param scrollElement Scrolling line container.
 */
export function consoleViewScrollElementStyle(scrollElement: HTMLElement): void {
  scrollElement.style.flex = '1 1 auto';
  scrollElement.style.minHeight = '0';
  scrollElement.style.overflow = 'auto';
  scrollElement.style.padding = '4px 8px';
  scrollElement.style.boxSizing = 'border-box';
  scrollElement.style.fontFamily = CONSOLE_VIEW_FONT_FAMILY;
  scrollElement.style.fontSize = '12px';
  scrollElement.style.lineHeight = '16px';
  scrollElement.style.whiteSpace = 'pre';
  scrollElement.style.userSelect = 'text';
  scrollElement.style.cursor = 'text';
}

/**
 * Styles one console line in the color of its level.
 *
 * @param lineElement Line element.
 * @param level Importance of the line.
 */
export function consoleViewLineElementStyle(lineElement: HTMLElement, level: ConsoleLogLevel): void {
  lineElement.style.whiteSpace = 'pre';
  lineElement.style.color = infoPanelSeverityColorRead(level);
}
