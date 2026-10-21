import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ConsoleLog } from '@/info_panel/console/console_log.js';
import { ConsoleView } from '@/info_panel/console/console_view.js';
import { consoleViewLineTimeFormat } from '@/info_panel/console/console_view_line.js';
import {
  INFO_PANEL_SEVERITY_COLOR_ERROR,
  INFO_PANEL_SEVERITY_COLOR_WARNING,
} from '@/info_panel/info_panel_severity.js';
import { FloatingPanelStack } from '@/ui/floating_panel/panel_floating_stack.js';

/**
 * Returns the line elements a console view shows.
 *
 * @param view Console view.
 * @returns Line elements in order.
 */
function linesRead(view: ConsoleView): HTMLElement[] {
  return Array.from(view.linesElementRead().children) as HTMLElement[];
}

/**
 * Normalizes a CSS color the way the DOM reports it.
 *
 * @param color CSS color.
 * @returns Color as read back from an element.
 */
function cssColorNormalize(color: string): string {
  const probe = document.createElement('div');
  probe.style.color = color;
  return probe.style.color;
}

/**
 * Unit tests for the console view: rendering lines with time and level colors,
 * following new lines, and clearing through the right-click menu.
 */
describe('ConsoleView', () => {
  let log: ConsoleLog;
  let view: ConsoleView;

  beforeEach(() => {
    FloatingPanelStack.resetForTests();
    log = new ConsoleLog(5);
    log.entryAppendInfo('already there');
    view = new ConsoleView(log);
    document.body.appendChild(view.getElement());
  });

  afterEach(() => {
    view.dispose();
    FloatingPanelStack.resetForTests();
  });

  it('fills its host as a fixed-width, non-wrapping column', () => {
    const root = view.getElement();
    expect(root.style.display).toBe('flex');
    expect(root.style.flexDirection).toBe('column');
    expect(root.style.height).toBe('100%');
    expect(view.linesElementRead().style.whiteSpace).toBe('pre');
    expect(view.linesElementRead().style.fontFamily.toLowerCase()).toContain('monospace');
  });

  it('shows existing and new lines with their time, colored by level', () => {
    log.entryAppendWarning('careful');
    log.entryAppendError('broken');
    const lines = linesRead(view);
    expect(lines.map((line) => line.dataset['level'])).toEqual(['info', 'warning', 'error']);
    const errorEntry = log.entriesRead().at(-1);
    expect(lines[2]?.textContent).toBe(`[${consoleViewLineTimeFormat(errorEntry?.timestampMilliseconds ?? 0)}] broken`);
    expect(lines[1]?.style.color).toBe(cssColorNormalize(INFO_PANEL_SEVERITY_COLOR_WARNING));
    expect(lines[2]?.style.color).toBe(cssColorNormalize(INFO_PANEL_SEVERITY_COLOR_ERROR));
  });

  it('drops the lines the capped log dropped', () => {
    for (let index = 0; index < 8; index += 1) {
      log.entryAppendInfo(`line ${index}`);
    }
    const lines = linesRead(view);
    expect(lines.length).toBe(log.entriesRead().length);
    expect(lines[0]?.textContent).toContain(log.entriesRead()[0]?.text ?? 'missing');
  });

  it('clears the log and the view from the right-click menu', () => {
    view.getElement().dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 30, clientY: 40 }));
    const clearRow = Array.from(document.querySelectorAll<HTMLButtonElement>('.editor-toolbar-dropdown-item')).find(
      (row) => row.textContent?.includes('Clear'),
    );
    expect(clearRow).toBeDefined();
    clearRow?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(log.entriesRead()).toEqual([]);
    expect(linesRead(view)).toEqual([]);
  });

  it('stops following the log and leaves its host once disposed', () => {
    view.dispose();
    log.entryAppendInfo('after dispose');
    expect(linesRead(view).length).toBe(1);
    expect(document.body.contains(view.getElement())).toBe(false);
  });
});
