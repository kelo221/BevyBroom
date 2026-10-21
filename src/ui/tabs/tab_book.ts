import {
  TAB_BOOK_CONTENT_CLASS,
  TAB_BOOK_PAGE_CLASS,
  TAB_BOOK_ROOT_CLASS,
  TAB_BOOK_STRIP_CLASS,
  TAB_BOOK_TAB_CLASS,
  tabBookStylesEnsure,
  tabBookVariantClass,
  type TabBookVariant,
} from './tab_book_styles.js';

/**
 * How pages live in the page host: `mounted` builds each page once and hides
 * inactive ones, keeping their scroll and widget state; `swapped` keeps only
 * the active page in the document.
 */
export type TabBookPageRetention = 'mounted' | 'swapped';

/** Options for one tab book. */
export interface TabBookOptions {
  /** Accessible name of the tab list. */
  ariaLabel: string;
  /** Visual variant; defaults to the underlined docked style. */
  variant?: TabBookVariant;
  /** Page retention mode; defaults to `mounted`. */
  pageRetention?: TabBookPageRetention;
  /** Document that creates the elements; defaults to the global document. */
  ownerDocument?: Document;
}

/** One tab: its id, its label and the function that returns its page. */
export interface TabBookTabDefinition {
  id: string;
  label: string;
  /** Returns the page element; called when the tab is shown. */
  pageResolve: () => HTMLElement;
  /** Optional tooltip, e.g. the shortcut that shows the tab. */
  tooltip?: string;
}

/** Listener told the id of the newly active tab. */
export type TabBookTabChangeListener = (tabId: string) => void;

/** Registered tab with its button and, once built, its page wrapper. */
interface TabBookTabEntry {
  definition: TabBookTabDefinition;
  button: HTMLButtonElement;
  pageWrapper: HTMLElement | null;
}

/** A row of tabs above a page host that shows one page at a time. */
export class TabBook {
  private readonly ownerDocument: Document;
  private readonly root: HTMLElement;
  private readonly strip: HTMLElement;
  private readonly content: HTMLElement;
  private readonly pageRetention: TabBookPageRetention;
  private readonly entries: Map<string, TabBookTabEntry>;
  private readonly listeners: Set<TabBookTabChangeListener>;
  private activeTabId: string | null;

  /**
   * Creates an empty tab book.
   *
   * @param options Accessible name, variant, page retention and document.
   */
  constructor(options: TabBookOptions) {
    this.ownerDocument = options.ownerDocument ?? document;
    this.pageRetention = options.pageRetention ?? 'mounted';
    this.entries = new Map();
    this.listeners = new Set();
    this.activeTabId = null;
    tabBookStylesEnsure(this.ownerDocument);
    this.root = this.elementCreate('div', TAB_BOOK_ROOT_CLASS);
    this.root.classList.add(tabBookVariantClass(options.variant ?? 'underline'));
    this.strip = this.stripCreate(options.ariaLabel);
    this.content = this.elementCreate('div', TAB_BOOK_CONTENT_CLASS);
    this.content.setAttribute('role', 'tabpanel');
    this.root.append(this.strip, this.content);
  }

  /**
   * Returns the root element holding the strip and the page host.
   *
   * @returns Tab book root.
   */
  getElement(): HTMLElement {
    return this.root;
  }

  /**
   * Returns the tab strip so callers can append trailing controls.
   *
   * @returns Tab strip element.
   */
  getStripElement(): HTMLElement {
    return this.strip;
  }

  /**
   * Returns the page host element.
   *
   * @returns Page host below the strip.
   */
  getContentElement(): HTMLElement {
    return this.content;
  }

  /**
   * Returns the id of the visible tab.
   *
   * @returns Active tab id, or null before any tab was shown.
   */
  getActiveTabId(): string | null {
    return this.activeTabId;
  }

  /**
   * Lists tab ids in strip order.
   *
   * @returns Tab ids.
   */
  tabIdsList(): string[] {
    return [...this.entries.keys()];
  }

  /**
   * Adds a tab at the end of the strip. The first added tab is shown.
   *
   * @param definition Tab id, label, page resolver and tooltip.
   */
  tabAdd(definition: TabBookTabDefinition): void {
    if (this.entries.has(definition.id)) {
      return;
    }
    const button = this.tabButtonCreate(definition);
    this.entries.set(definition.id, { definition, button, pageWrapper: null });
    this.strip.appendChild(button);
    if (this.activeTabId === null) {
      this.tabShow(definition.id);
    }
  }

  /**
   * Shows a tab and tells the listeners when the active tab changed.
   *
   * @param tabId Tab to show.
   * @returns True when the tab exists.
   */
  tabShow(tabId: string): boolean {
    const entry = this.entries.get(tabId);
    if (!entry) {
      return false;
    }
    const previousTabId = this.activeTabId;
    this.activeTabId = tabId;
    this.tabButtonsSelectionApply();
    this.pageShow(entry);
    this.content.setAttribute('aria-label', entry.definition.label);
    if (previousTabId !== tabId) {
      this.listeners.forEach((listener) => listener(tabId));
    }
    return true;
  }

  /**
   * Builds and mounts the page of every tab at once, keeping all but the active
   * page hidden. Does nothing in the swapped retention mode.
   */
  pagesMountAll(): void {
    if (this.pageRetention === 'swapped') {
      return;
    }
    this.entries.forEach((entry) => {
      const wrapper = this.pageWrapperEnsure(entry);
      wrapper.hidden = entry.definition.id !== this.activeTabId;
    });
  }

  /**
   * Registers a listener for active tab changes.
   *
   * @param listener Called with the new tab id.
   * @returns Function that removes the listener.
   */
  tabChangeListenerAdd(listener: TabBookTabChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Removes the tab book from the document and drops its listeners. */
  dispose(): void {
    this.listeners.clear();
    this.root.remove();
  }

  /**
   * Creates the tab list row.
   *
   * @param ariaLabel Accessible name of the tab list.
   * @returns Tab strip element.
   */
  private stripCreate(ariaLabel: string): HTMLElement {
    const strip = this.elementCreate('div', TAB_BOOK_STRIP_CLASS);
    strip.setAttribute('role', 'tablist');
    strip.setAttribute('aria-label', ariaLabel);
    return strip;
  }

  /**
   * Creates one tab button that shows its tab when clicked.
   *
   * @param definition Tab definition.
   * @returns Tab button.
   */
  private tabButtonCreate(definition: TabBookTabDefinition): HTMLButtonElement {
    const button = this.ownerDocument.createElement('button');
    button.type = 'button';
    button.className = TAB_BOOK_TAB_CLASS;
    button.textContent = definition.label;
    button.dataset['tabId'] = definition.id;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', 'false');
    if (definition.tooltip) {
      button.title = definition.tooltip;
    }
    button.addEventListener('click', () => this.tabShow(definition.id));
    return button;
  }

  /** Marks only the active tab button as selected. */
  private tabButtonsSelectionApply(): void {
    this.entries.forEach((entry, id) => {
      entry.button.setAttribute('aria-selected', id === this.activeTabId ? 'true' : 'false');
    });
  }

  /**
   * Shows the page of one tab following the page retention mode.
   *
   * @param entry Tab whose page becomes visible.
   */
  private pageShow(entry: TabBookTabEntry): void {
    if (this.pageRetention === 'swapped') {
      this.content.replaceChildren(entry.definition.pageResolve());
      return;
    }
    const wrapper = this.pageWrapperEnsure(entry);
    this.entries.forEach((other) => {
      if (other.pageWrapper) {
        other.pageWrapper.hidden = other !== entry;
      }
    });
    wrapper.hidden = false;
  }

  /**
   * Builds the page wrapper of a tab the first time it is shown.
   *
   * @param entry Tab entry.
   * @returns Page wrapper mounted in the page host.
   */
  private pageWrapperEnsure(entry: TabBookTabEntry): HTMLElement {
    if (entry.pageWrapper) {
      return entry.pageWrapper;
    }
    const wrapper = this.elementCreate('div', TAB_BOOK_PAGE_CLASS);
    wrapper.dataset['tabPage'] = entry.definition.id;
    wrapper.appendChild(entry.definition.pageResolve());
    this.content.appendChild(wrapper);
    entry.pageWrapper = wrapper;
    return wrapper;
  }

  /**
   * Creates an element with one class.
   *
   * @param tagName Element tag.
   * @param className Class to add.
   * @returns New element.
   */
  private elementCreate(tagName: string, className: string): HTMLElement {
    const element = this.ownerDocument.createElement(tagName);
    element.className = className;
    return element;
  }
}
