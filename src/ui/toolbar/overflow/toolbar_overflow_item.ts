import type { ToolbarMenuEntry } from '@/ui/menu/menu_types.js';
import { toolbarOverflowEntriesFromButtons } from './toolbar_overflow_entries_fallback.js';

/**
 * Supplies the overflow menu entries that stand in for one collapsed toolbar
 * item.
 */
export type ToolbarOverflowEntriesProvider = () => ToolbarMenuEntry[];

/** Collapse rank of global toolbar actions; they collapse first. */
export const TOOLBAR_OVERFLOW_PRIORITY_GLOBAL = 1;

/** Collapse rank of the active tool options; they collapse after global actions. */
export const TOOLBAR_OVERFLOW_PRIORITY_TOOL_OPTIONS = 2;

/** Collapse rank of trailing status controls; they collapse last. */
export const TOOLBAR_OVERFLOW_PRIORITY_TRAILING = 3;

/**
 * Data attribute (dataset key) marking an element as a collapsible toolbar
 * item.
 */
const TOOLBAR_OVERFLOW_ITEM_DATASET_KEY = 'toolbarOverflowItem';

/** CSS selector matching every collapsible toolbar item. */
export const TOOLBAR_OVERFLOW_ITEM_SELECTOR = '[data-toolbar-overflow-item]';

/** Entry providers of marked items, keyed by the item element. */
const toolbarOverflowProvidersByElement = new WeakMap<HTMLElement, ToolbarOverflowEntriesProvider>();

/**
 * Marks an element as a toolbar item that may collapse into the overflow menu.
 *
 * @param element Item element placed in a toolbar row.
 * @param priority Collapse rank; lower ranks collapse first.
 * @param provider Optional source of the menu entries shown while collapsed;
 *   the buttons inside the element are used when omitted.
 */
export function toolbarOverflowItemMark(
  element: HTMLElement,
  priority: number,
  provider?: ToolbarOverflowEntriesProvider,
): void {
  element.dataset[TOOLBAR_OVERFLOW_ITEM_DATASET_KEY] = String(priority);
  if (provider) {
    toolbarOverflowProvidersByElement.set(element, provider);
  }
}

/**
 * Returns the collapse rank of a marked item.
 *
 * @param element Marked item element.
 * @returns Collapse rank, or the global rank when the mark is missing or
 *   invalid.
 */
export function toolbarOverflowItemPriorityRead(element: HTMLElement): number {
  const parsed = Number(element.dataset[TOOLBAR_OVERFLOW_ITEM_DATASET_KEY]);
  return Number.isFinite(parsed) ? parsed : TOOLBAR_OVERFLOW_PRIORITY_GLOBAL;
}

/**
 * Returns the overflow menu entries that stand in for a collapsed item.
 *
 * @param element Collapsed item element.
 * @returns Entries from the registered provider, or entries built from the
 *   buttons inside the element.
 */
export function toolbarOverflowItemEntriesRead(element: HTMLElement): ToolbarMenuEntry[] {
  const provider = toolbarOverflowProvidersByElement.get(element);
  return provider ? provider() : toolbarOverflowEntriesFromButtons(element);
}
