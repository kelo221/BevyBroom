import { Theme } from '@/theme.js';
import {
  applyMenuItemEnabledState,
  applyMenuItemHoverState,
  styleMenuActionRow,
  styleMenuLabel,
  styleMenuShortcut,
} from '@/ui/menu/menu_styles.js';
import type { CommandSearchItem } from '@/ui/command_search/command_search_item.js';

/** Height limit of the result list in CSS pixels. */
const COMMAND_SEARCH_LIST_MAX_HEIGHT_PX = 360;

/** Separator shown between the menu titles of a command path. */
const COMMAND_SEARCH_LIST_PATH_SEPARATOR = ' \u203a ';

/** One rendered result row. */
interface CommandSearchListRow {
  readonly item: CommandSearchItem;
  readonly button: HTMLButtonElement;
}

/**
 * Result list of the command search: one row per command with its label, menu
 * path and shortcut, and one active row that the keyboard moves and runs.
 */
export class CommandSearchList {
  private readonly element: HTMLElement;
  private readonly ownerDocument: Document;
  private readonly onChoose: (item: CommandSearchItem) => void;
  private rows: CommandSearchListRow[] = [];
  private activeIndex = 0;

  /**
   * Creates an empty list.
   *
   * @param ownerDocument Document that owns the rows.
   * @param onChoose Runs when a row is clicked.
   */
  constructor(ownerDocument: Document, onChoose: (item: CommandSearchItem) => void) {
    this.ownerDocument = ownerDocument;
    this.onChoose = onChoose;
    this.element = ownerDocument.createElement('div');
    this.element.setAttribute('role', 'listbox');
    this.element.style.maxHeight = `${COMMAND_SEARCH_LIST_MAX_HEIGHT_PX}px`;
    this.element.style.overflowY = 'auto';
    this.element.style.marginTop = '4px';
  }

  /**
   * Returns the list element.
   *
   * @returns List DOM node.
   */
  getElement(): HTMLElement {
    return this.element;
  }

  /**
   * Shows the given commands and makes the first one active.
   *
   * @param items Commands in display order.
   */
  itemsShow(items: readonly CommandSearchItem[]): void {
    this.rows = items.map((item, index) => ({ item, button: this.rowCreate(item, index) }));
    this.element.replaceChildren(...this.rows.map((row) => row.button));
    this.activeIndexWrite(0);
  }

  /**
   * Moves the active row by a number of rows, wrapping at both ends.
   *
   * @param delta Rows to move; negative moves up.
   */
  activeMove(delta: number): void {
    if (this.rows.length === 0) {
      return;
    }
    this.activeIndexWrite((this.activeIndex + delta + this.rows.length) % this.rows.length);
  }

  /**
   * Returns the command of the active row.
   *
   * @returns Active command, or null when the list is empty.
   */
  activeItemRead(): CommandSearchItem | null {
    return this.rows[this.activeIndex]?.item ?? null;
  }

  /**
   * Creates the row of one command.
   *
   * @param item Command.
   * @param index Row index.
   * @returns Row button.
   */
  private rowCreate(item: CommandSearchItem, index: number): HTMLButtonElement {
    const button = this.ownerDocument.createElement('button');
    button.type = 'button';
    button.setAttribute('role', 'option');
    button.dataset['commandKey'] = item.key;
    styleMenuActionRow(button);
    button.append(this.rowLabelCreate(item), this.rowShortcutCreate(item));
    applyMenuItemEnabledState(button, item.isEnabled());
    button.addEventListener('mousemove', () => this.activeIndexWrite(index));
    button.addEventListener('click', () => this.onChoose(item));
    return button;
  }

  /**
   * Creates the label of a row with its menu path after it.
   *
   * @param item Command.
   * @returns Label element.
   */
  private rowLabelCreate(item: CommandSearchItem): HTMLElement {
    const label = this.ownerDocument.createElement('span');
    label.className = 'command-search-label';
    styleMenuLabel(label);
    label.textContent = item.label;
    const path = this.ownerDocument.createElement('span');
    path.className = 'command-search-path';
    path.textContent = `  ${item.path.join(COMMAND_SEARCH_LIST_PATH_SEPARATOR)}`;
    path.style.color = Theme.secondaryTextColor;
    path.style.opacity = '0.8';
    label.appendChild(path);
    return label;
  }

  /**
   * Creates the shortcut hint of a row.
   *
   * @param item Command.
   * @returns Shortcut element, empty when the command has none.
   */
  private rowShortcutCreate(item: CommandSearchItem): HTMLElement {
    const shortcut = this.ownerDocument.createElement('span');
    styleMenuShortcut(shortcut);
    shortcut.textContent = item.shortcut;
    return shortcut;
  }

  /**
   * Makes one row active, highlights it and scrolls it into view.
   *
   * @param index Row index.
   */
  private activeIndexWrite(index: number): void {
    this.rows.forEach((row, rowIndex) => applyMenuItemHoverState(row.button, rowIndex === index));
    this.rows.forEach((row) => row.button.setAttribute('aria-selected', 'false'));
    this.activeIndex = index;
    const activeButton = this.rows[index]?.button;
    activeButton?.setAttribute('aria-selected', 'true');
    activeButton?.scrollIntoView?.({ block: 'nearest' });
  }
}
