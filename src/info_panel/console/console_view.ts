import { InfoPanelView } from '@/info_panel/info_panel_view.js';
import { ConsoleLog } from '@/info_panel/console/console_log.js';
import type { ConsoleLogChange, ConsoleLogChangeAppend } from '@/info_panel/console/console_log_entry.js';
import { consoleViewLineElementCreate } from '@/info_panel/console/console_view_line.js';
import { consoleViewScrollElementStyle } from '@/info_panel/console/console_view_styles.js';
import { ConsoleViewContextMenu } from '@/info_panel/console/console_view_context_menu.js';

/** Distance from the bottom, in pixels, that still counts as at the bottom. */
const CONSOLE_VIEW_BOTTOM_TOLERANCE_PIXELS = 4;

/**
 * Read-only view of a console log: one fixed-width line per message, colored by
 * level, following new lines while scrolled to the bottom, with a right-click
 * Clear.
 */
export class ConsoleView extends InfoPanelView {
  private readonly consoleLog: ConsoleLog;
  private readonly scrollElement: HTMLElement;
  private readonly contextMenu: ConsoleViewContextMenu;
  private readonly changeListenerRemove: () => void;

  /**
   * Creates the view showing every line already in the log.
   *
   * @param consoleLog Log shown; defaults to the shared log.
   */
  constructor(consoleLog: ConsoleLog = ConsoleLog.shared()) {
    super('editor-console-view');
    this.consoleLog = consoleLog;
    this.scrollElement = document.createElement('div');
    this.scrollElement.className = 'editor-console-lines';
    consoleViewScrollElementStyle(this.scrollElement);
    this.rootElement.appendChild(this.scrollElement);
    this.contextMenu = new ConsoleViewContextMenu(this.rootElement, () => this.consoleLog.clear());
    this.linesRenderAll();
    this.changeListenerRemove = this.consoleLog.changeListenerAdd((change) => this.logChangeApply(change));
  }

  /**
   * Returns the element whose children are the line elements.
   *
   * @returns Scrolling line container.
   */
  linesElementRead(): HTMLElement {
    return this.scrollElement;
  }

  /** @inheritdoc */
  protected disposeContent(): void {
    this.changeListenerRemove();
    this.contextMenu.dispose();
  }

  /** Replaces the shown lines with every line of the log. */
  private linesRenderAll(): void {
    this.scrollElement.replaceChildren(...this.consoleLog.entriesRead().map(consoleViewLineElementCreate));
    this.scrollToBottom();
  }

  /**
   * Updates the shown lines after the log changed.
   *
   * @param change What changed.
   */
  private logChangeApply(change: ConsoleLogChange): void {
    if (change.kind === 'clear') {
      this.scrollElement.replaceChildren();
      return;
    }
    this.lineAppend(change);
  }

  /**
   * Shows a new line, drops the lines the log dropped and keeps following the
   * bottom when the view was there.
   *
   * @param change The write.
   */
  private lineAppend(change: ConsoleLogChangeAppend): void {
    const wasAtBottom = this.scrolledToBottomIs();
    for (let droppedIndex = 0; droppedIndex < change.droppedCount; droppedIndex += 1) {
      this.scrollElement.firstElementChild?.remove();
    }
    this.scrollElement.appendChild(consoleViewLineElementCreate(change.entry));
    if (wasAtBottom) {
      this.scrollToBottom();
    }
  }

  /**
   * Returns whether the lines are scrolled to the bottom.
   *
   * @returns True when the last line is in view.
   */
  private scrolledToBottomIs(): boolean {
    const element = this.scrollElement;
    const distanceToBottom = element.scrollHeight - element.clientHeight - element.scrollTop;
    return distanceToBottom <= CONSOLE_VIEW_BOTTOM_TOLERANCE_PIXELS;
  }

  /** Scrolls so the last line is in view. */
  private scrollToBottom(): void {
    this.scrollElement.scrollTop = this.scrollElement.scrollHeight;
  }
}
