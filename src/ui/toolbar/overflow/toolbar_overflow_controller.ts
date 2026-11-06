import { isMenuSeparator, type ToolbarMenuEntry } from '@/ui/menu/menu_types.js';
import {
  TOOLBAR_OVERFLOW_ITEM_SELECTOR,
  toolbarOverflowItemEntriesRead,
  toolbarOverflowItemPriorityRead,
} from './toolbar_overflow_item.js';
import { ToolbarOverflowMeasureDom, type ToolbarOverflowMeasure } from './toolbar_overflow_measure.js';

/**
 * Keeps a single-line toolbar row from clipping: items that do not fit are
 * hidden, lowest collapse rank first and right to left within a rank, and the
 * overflow trigger is shown while any item is hidden. The hidden items become
 * the entries of the overflow menu.
 */
export class ToolbarOverflowController {
  private readonly row: HTMLElement;
  private readonly trigger: HTMLElement;
  private readonly measure: ToolbarOverflowMeasure;
  private readonly collapsedDisplayByItem: Map<HTMLElement, string>;
  private resizeObserver: ResizeObserver | null;
  private mutationObserver: MutationObserver | null;
  private pendingFrameId: number | null;

  /**
   * Creates the controller for one row.
   *
   * @param row Toolbar row whose marked items may collapse.
   * @param trigger Element that opens the overflow menu; hidden while
   *   everything fits.
   * @param measure Width check of the row; laid-out DOM widths by default.
   */
  constructor(
    row: HTMLElement,
    trigger: HTMLElement,
    measure: ToolbarOverflowMeasure = new ToolbarOverflowMeasureDom(),
  ) {
    this.row = row;
    this.trigger = trigger;
    this.measure = measure;
    this.collapsedDisplayByItem = new Map();
    this.resizeObserver = null;
    this.mutationObserver = null;
    this.pendingFrameId = null;
    this.triggerVisibleSet(false);
  }

  /** Shows every item, then collapses items until the row fits. */
  refresh(): void {
    this.collapsedItemsRestore();
    this.triggerVisibleSet(false);
    if (!this.measure.rowIsOverflowing(this.row)) {
      return;
    }
    this.triggerVisibleSet(true);
    const candidates = this.collapseCandidatesOrdered();
    for (const item of candidates) {
      if (!this.measure.rowIsOverflowing(this.row)) {
        return;
      }
      this.itemCollapse(item);
    }
  }

  /**
   * Returns the hidden items in row order.
   *
   * @returns Collapsed items still in the row.
   */
  collapsedItemsRead(): HTMLElement[] {
    return this.markedItemsRead().filter((item) => this.collapsedDisplayByItem.has(item));
  }

  /**
   * Builds the overflow menu from the hidden items, dropping separators at the
   * edges and repeated separators.
   *
   * @returns Menu entries of the overflow menu.
   */
  menuEntriesBuild(): ToolbarMenuEntry[] {
    const entries = this.collapsedItemsRead().flatMap((item) => toolbarOverflowItemEntriesRead(item));
    return toolbarOverflowSeparatorsTidy(entries);
  }

  /** Refreshes on the next frame whenever the row resizes or its items change. */
  observe(): void {
    this.observersDisconnect();
    const schedule = (): void => this.refreshSchedule();
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(schedule);
      this.resizeObserver.observe(this.row);
    }
    if (typeof MutationObserver !== 'undefined') {
      this.mutationObserver = new MutationObserver(schedule);
      this.mutationObserver.observe(this.row, { childList: true, subtree: true });
    }
  }

  /** Stops observing, cancels a pending refresh and shows every item again. */
  dispose(): void {
    this.observersDisconnect();
    this.pendingRefreshCancel();
    this.collapsedItemsRestore();
  }

  /** Schedules one refresh on the next animation frame. */
  private refreshSchedule(): void {
    if (this.pendingFrameId !== null) {
      return;
    }
    this.pendingFrameId = requestAnimationFrame(() => {
      this.pendingFrameId = null;
      this.refresh();
    });
  }

  /** Cancels the scheduled refresh when one is pending. */
  private pendingRefreshCancel(): void {
    if (this.pendingFrameId === null) {
      return;
    }
    cancelAnimationFrame(this.pendingFrameId);
    this.pendingFrameId = null;
  }

  /** Disconnects the resize and mutation observers. */
  private observersDisconnect(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.mutationObserver?.disconnect();
    this.mutationObserver = null;
  }

  /**
   * Lists the marked items of the row in document order.
   *
   * @returns Marked items.
   */
  private markedItemsRead(): HTMLElement[] {
    return Array.from(this.row.querySelectorAll<HTMLElement>(TOOLBAR_OVERFLOW_ITEM_SELECTOR));
  }

  /**
   * Orders the shown items for collapsing: lowest rank first, rightmost first
   * within a rank. Items hidden by their owners are skipped.
   *
   * @returns Items in collapse order.
   */
  private collapseCandidatesOrdered(): HTMLElement[] {
    const shown = this.markedItemsRead()
      .map((item, index) => ({ item, index, priority: toolbarOverflowItemPriorityRead(item) }))
      .filter((candidate) => candidate.item.style.display !== 'none');
    shown.sort((first, second) => first.priority - second.priority || second.index - first.index);
    return shown.map((candidate) => candidate.item);
  }

  /**
   * Hides one item and remembers its display value.
   *
   * @param item Item to hide.
   */
  private itemCollapse(item: HTMLElement): void {
    this.collapsedDisplayByItem.set(item, item.style.display);
    item.style.display = 'none';
  }

  /** Shows every hidden item again with its remembered display value. */
  private collapsedItemsRestore(): void {
    this.collapsedDisplayByItem.forEach((display, item) => {
      item.style.display = display;
    });
    this.collapsedDisplayByItem.clear();
  }

  /**
   * Shows or hides the overflow trigger.
   *
   * @param visible True to show it.
   */
  private triggerVisibleSet(visible: boolean): void {
    this.trigger.style.display = visible ? 'inline-flex' : 'none';
  }
}

/**
 * Removes separators at the start and end of an entry list and collapses runs
 * of separators into one.
 *
 * @param entries Raw entries.
 * @returns Entries without stray separators.
 */
export function toolbarOverflowSeparatorsTidy(entries: readonly ToolbarMenuEntry[]): ToolbarMenuEntry[] {
  const tidy: ToolbarMenuEntry[] = [];
  entries.forEach((entry) => {
    const previous = tidy[tidy.length - 1];
    const isRepeatedOrLeading = isMenuSeparator(entry) && (previous === undefined || isMenuSeparator(previous));
    if (!isRepeatedOrLeading) {
      tidy.push(entry);
    }
  });
  const last = tidy[tidy.length - 1];
  if (last !== undefined && isMenuSeparator(last)) {
    tidy.pop();
  }
  return tidy;
}
