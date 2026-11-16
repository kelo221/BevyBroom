import { failResult, okResult } from './editor_api_result.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';

/** Selector of every menu panel and of the command search. */
const EDITOR_API_OPEN_MENUS_ROOT_SELECTOR = '[role="menu"], [data-command-search]';

/** One row of an open menu as get_open_menus reports it. */
interface EditorApiOpenMenuRow {
  readonly label: string;
  readonly shortcut: string;
  readonly enabled: boolean;
  /** Menu path of a command search result. */
  readonly path?: string;
  /** True on the command search result Enter runs. */
  readonly active?: boolean;
}

/** One open menu as get_open_menus reports it. */
interface EditorApiOpenMenu {
  readonly kind: 'menu' | 'command_search';
  readonly rows: readonly EditorApiOpenMenuRow[];
  /** Text typed into the command search. */
  readonly query?: string;
}

/**
 * Reads the menus that are open on screen (menu bar dropdowns, right-click
 * menus and the command search) and clicks their rows, the way a user reads and
 * clicks them.
 */
export class EditorApiOpenMenus {
  private readonly ownerDocument: Document;

  /**
   * Creates the open menu tools.
   *
   * @param ownerDocument Document the menus open in.
   */
  constructor(ownerDocument: Document = document) {
    this.ownerDocument = ownerDocument;
  }

  /**
   * Runs an open menu tool.
   *
   * @param name Tool name.
   * @param args Tool arguments.
   * @returns Tool result, or null when the name is no open menu tool.
   */
  openMenusToolDispatch(name: string, args: Record<string, unknown>): McpToolResult | null {
    switch (name) {
      case 'get_open_menus':
        return okResult('Open menus', { menus: this.openMenusRead() });
      case 'choose_open_menu_item':
        return this.openMenuItemChoose(args['label']);
      default:
        return null;
    }
  }

  /**
   * Clicks the first enabled row with a label in the open menus.
   *
   * @param label Row label argument.
   * @returns Result with the menus still open afterwards.
   */
  private openMenuItemChoose(label: unknown): McpToolResult {
    if (typeof label !== 'string' || label === '') {
      return failResult('label must be the text of a row in an open menu');
    }
    const row = this.openRowElementsRead().find(
      (element) => this.rowLabelRead(element) === label && !this.rowIsDisabled(element),
    );
    if (!row) {
      return failResult(`No enabled row "${label}" in an open menu`);
    }
    row.click();
    return okResult(`Chose ${label}`, { menus: this.openMenusRead() });
  }

  /**
   * Reads every open menu with its rows.
   *
   * @returns Open menus in document order.
   */
  private openMenusRead(): EditorApiOpenMenu[] {
    return this.openRootsRead().map((root) => this.menuRead(root));
  }

  /**
   * Returns the menu and command search roots that are on screen.
   *
   * @returns Shown roots.
   */
  private openRootsRead(): HTMLElement[] {
    const roots = Array.from(this.ownerDocument.querySelectorAll<HTMLElement>(EDITOR_API_OPEN_MENUS_ROOT_SELECTOR));
    return roots.filter((root) => root.isConnected && root.style.display !== 'none');
  }

  /**
   * Returns the row elements of every open menu.
   *
   * @returns Rows in document order.
   */
  private openRowElementsRead(): HTMLElement[] {
    return this.openRootsRead().flatMap((root) => this.rowElementsRead(root));
  }

  /**
   * Reads one open menu.
   *
   * @param root Menu or command search root.
   * @returns Menu with its rows.
   */
  private menuRead(root: HTMLElement): EditorApiOpenMenu {
    const rows = this.rowElementsRead(root).map((element) => this.rowRead(element));
    if (root.dataset['commandSearch'] === undefined) {
      return { kind: 'menu', rows };
    }
    return { kind: 'command_search', rows, query: root.querySelector('input')?.value ?? '' };
  }

  /**
   * Returns the rows that belong to a root and not to a nested submenu.
   *
   * @param root Menu or command search root.
   * @returns Row elements.
   */
  private rowElementsRead(root: HTMLElement): HTMLElement[] {
    const rows = Array.from(root.querySelectorAll<HTMLElement>('[role="menuitem"], [role="option"]'));
    return rows.filter((row) => row.closest(EDITOR_API_OPEN_MENUS_ROOT_SELECTOR) === root);
  }

  /**
   * Reads one row.
   *
   * @param element Row element.
   * @returns Label, shortcut, enablement and the command search extras.
   */
  private rowRead(element: HTMLElement): EditorApiOpenMenuRow {
    const shortcut = element.querySelector('.editor-toolbar-dropdown-shortcut')?.textContent?.trim() ?? '';
    const row = { label: this.rowLabelRead(element), shortcut, enabled: !this.rowIsDisabled(element) };
    const path = element.querySelector('.command-search-path')?.textContent?.trim();
    if (path === undefined) {
      return row;
    }
    return { ...row, path, active: element.getAttribute('aria-selected') === 'true' };
  }

  /**
   * Reads the label text of a row, leaving out its icon and menu path.
   *
   * @param element Row element.
   * @returns Label text.
   */
  private rowLabelRead(element: HTMLElement): string {
    const labelElement = element.querySelector('.editor-toolbar-dropdown-label, .command-search-label');
    const labelTextNode = Array.from(labelElement?.childNodes ?? []).find((node) => node.nodeType === Node.TEXT_NODE);
    return labelTextNode?.textContent?.trim() ?? '';
  }

  /**
   * Returns whether a row cannot be chosen.
   *
   * @param element Row element.
   * @returns True for disabled rows.
   */
  private rowIsDisabled(element: HTMLElement): boolean {
    return element instanceof HTMLButtonElement && element.disabled;
  }
}
