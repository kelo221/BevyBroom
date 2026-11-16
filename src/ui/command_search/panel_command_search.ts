import { styleMenuPanel } from '@/ui/menu/menu_styles.js';
import { UiStackLayers } from '@/ui/stack/ui_stack_layers.js';
import { InputText } from '@/ui/input/input_text.js';
import { CommandSearchCatalog } from '@/ui/command_search/command_search_catalog.js';
import { CommandSearchHistory } from '@/ui/command_search/command_search_history.js';
import { CommandSearchList } from '@/ui/command_search/command_search_list.js';
import { CommandSearchMatcher } from '@/ui/command_search/command_search_matcher.js';
import type { CommandSearchItem, CommandSearchMenuSource } from '@/ui/command_search/command_search_item.js';

/** Width of the command search in CSS pixels. */
const PANEL_COMMAND_SEARCH_WIDTH_PX = 480;

/** Distance of the command search from the top of the window, in percent. */
const PANEL_COMMAND_SEARCH_TOP_PERCENT = 12;

/**
 * Command search: a field that finds every menu command by typing part of its
 * name or menu, lists it with its menu path and shortcut, and runs the chosen
 * one. Arrow keys move through the results, Enter runs, Escape or a click
 * outside closes. Recently run commands come first while the field is empty.
 */
export class PanelCommandSearch {
  private readonly ownerDocument: Document;
  private readonly sourcesRead: () => readonly CommandSearchMenuSource[];
  private readonly root: HTMLElement;
  private readonly input: HTMLInputElement;
  private readonly list: CommandSearchList;
  private readonly history: CommandSearchHistory;
  private readonly outsidePointerListener: (event: MouseEvent) => void;
  private items: CommandSearchItem[] = [];

  /**
   * Creates a closed command search.
   *
   * @param ownerDocument Document the search opens in.
   * @param sourcesRead Returns the menus whose commands are searched.
   */
  constructor(ownerDocument: Document, sourcesRead: () => readonly CommandSearchMenuSource[]) {
    this.ownerDocument = ownerDocument;
    this.sourcesRead = sourcesRead;
    this.history = new CommandSearchHistory();
    this.input = this.inputCreate();
    this.list = new CommandSearchList(ownerDocument, (item) => this.itemRun(item));
    this.root = this.rootCreate();
    this.outsidePointerListener = (event) => this.outsidePointerHandle(event);
  }

  /** Opens the search with an empty field, or selects the typed text when open. */
  open(): void {
    if (this.isOpen()) {
      this.input.select();
      return;
    }
    this.items = CommandSearchCatalog.itemsCollect(this.sourcesRead());
    this.input.value = '';
    this.ownerDocument.body.appendChild(this.root);
    this.ownerDocument.addEventListener('mousedown', this.outsidePointerListener, true);
    this.resultsShow();
    this.input.focus();
  }

  /** Closes the search and forgets the collected commands. */
  close(): void {
    if (!this.isOpen()) {
      return;
    }
    this.ownerDocument.removeEventListener('mousedown', this.outsidePointerListener, true);
    this.root.remove();
    this.items = [];
  }

  /**
   * Returns whether the search is open.
   *
   * @returns True while shown.
   */
  isOpen(): boolean {
    return this.root.isConnected;
  }

  /**
   * Creates the search field.
   *
   * @returns Field element.
   */
  private inputCreate(): HTMLInputElement {
    const input = new InputText('Search commands').getElement();
    input.placeholder = 'Search commands\u2026';
    input.style.width = '100%';
    input.style.boxSizing = 'border-box';
    input.addEventListener('input', () => this.resultsShow());
    return input;
  }

  /**
   * Creates the floating root holding the field and the results.
   *
   * @returns Root element.
   */
  private rootCreate(): HTMLElement {
    const root = this.ownerDocument.createElement('div');
    styleMenuPanel(root, false);
    root.dataset['commandSearch'] = 'true';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Search Commands');
    root.style.display = 'block';
    root.style.zIndex = String(UiStackLayers.contextMenu);
    root.style.width = `${PANEL_COMMAND_SEARCH_WIDTH_PX}px`;
    root.style.left = `calc(50% - ${PANEL_COMMAND_SEARCH_WIDTH_PX / 2}px)`;
    root.style.top = `${PANEL_COMMAND_SEARCH_TOP_PERCENT}%`;
    root.append(this.input, this.list.getElement());
    root.addEventListener('keydown', (event) => this.keyHandle(event), true);
    return root;
  }

  /** Ranks the commands for the typed text and shows them. */
  private resultsShow(): void {
    const query = this.input.value;
    const ordered = query.trim() === '' ? this.history.recentFirstOrder(this.items) : this.items;
    this.list.itemsShow(CommandSearchMatcher.rank(query, ordered));
  }

  /**
   * Moves through, runs or closes the results from the keyboard. Every key
   * stays inside the search so editor shortcuts do not run while typing.
   *
   * @param event Key press inside the search.
   */
  private keyHandle(event: KeyboardEvent): void {
    event.stopPropagation();
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.list.activeMove(event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.activeItemRun();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
    }
  }

  /** Runs the active result when there is one. */
  private activeItemRun(): void {
    const item = this.list.activeItemRead();
    if (item) {
      this.itemRun(item);
    }
  }

  /**
   * Closes the search and runs an enabled command, remembering it as recent.
   *
   * @param item Chosen command.
   */
  private itemRun(item: CommandSearchItem): void {
    if (!item.isEnabled()) {
      return;
    }
    this.close();
    this.history.record(item.key);
    item.run();
  }

  /**
   * Closes the search when a press lands outside it.
   *
   * @param event Document press.
   */
  private outsidePointerHandle(event: MouseEvent): void {
    if (event.target instanceof Node && this.root.contains(event.target)) {
      return;
    }
    this.close();
  }
}
