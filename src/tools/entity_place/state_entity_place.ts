import type { EntityBrowserCatalogEntry } from '@/entity_browser/catalog/entity_browser_catalog_entry.js';

/** Listener notified when the active Entity tool class or catalog changes. */
export type StateEntityPlaceListener = () => void;

/**
 * Tracks the active placeable entity catalog entry and placement callback used
 * by the Hammer++ Entity click-to-place tool.
 */
export class StateEntityPlace {
  private toolActive: boolean;
  private entries: EntityBrowserCatalogEntry[];
  private activeEntryId: string | null;
  private isActiveEntryChosen: boolean;
  private placeDelegate: ((entry: EntityBrowserCatalogEntry, clientX: number, clientY: number) => boolean) | null;
  private browseDelegate: (() => void) | null;
  private readonly listeners: Set<StateEntityPlaceListener>;

  /** Creates an empty Entity tool placement state. */
  constructor() {
    this.toolActive = false;
    this.entries = [];
    this.activeEntryId = null;
    this.isActiveEntryChosen = false;
    this.placeDelegate = null;
    this.browseDelegate = null;
    this.listeners = new Set();
  }

  /**
   * Registers the callback that opens the entity browser for the Entity tool.
   *
   * @param delegate Opening function, or null to clear.
   */
  browseDelegateWrite(delegate: (() => void) | null): void {
    this.browseDelegate = delegate;
  }

  /**
   * Opens the entity browser through the registered callback.
   *
   * @returns True when a callback opened the browser.
   */
  browseRequest(): boolean {
    if (!this.browseDelegate) {
      return false;
    }
    this.browseDelegate();
    return true;
  }

  /**
   * Returns whether the Entity click-to-place tool is currently active.
   *
   * @returns True when active.
   */
  toolActiveRead(): boolean {
    return this.toolActive;
  }

  /**
   * Sets whether the Entity click-to-place tool is active.
   *
   * @param active True when active.
   */
  toolActiveWrite(active: boolean): void {
    if (this.toolActive === active) {
      return;
    }
    this.toolActive = active;
    this.listenersNotify();
  }

  /**
   * Updates the list of placeable catalog entries available to the Entity tool.
   * Until the user picks an entry, or when the picked one is gone, the default
   * entry becomes active.
   *
   * @param entries Placeable catalog entries.
   * @param defaultEntryId Entry to activate by default; the first entry when
   *   null or not listed.
   */
  entriesWrite(entries: readonly EntityBrowserCatalogEntry[], defaultEntryId: string | null = null): void {
    this.entries = [...entries];
    const isActiveListed = this.entries.some((entry) => entry.id === this.activeEntryId);
    if (!this.isActiveEntryChosen || !isActiveListed) {
      this.activeEntryId = this.entryIdDefaultResolve(defaultEntryId);
    }
    this.listenersNotify();
  }

  /**
   * Returns the default entry id when it is listed, else the first entry's.
   *
   * @param defaultEntryId Preferred default entry id, or null.
   * @returns Entry id, or null without entries.
   */
  private entryIdDefaultResolve(defaultEntryId: string | null): string | null {
    const isDefaultListed = this.entries.some((entry) => entry.id === defaultEntryId);
    return isDefaultListed ? defaultEntryId : (this.entries[0]?.id ?? null);
  }

  /**
   * Returns all available placeable catalog entries.
   *
   * @returns Catalog entries.
   */
  entriesRead(): readonly EntityBrowserCatalogEntry[] {
    return this.entries;
  }

  /**
   * Returns the currently selected catalog entry for click-to-place.
   *
   * @returns Active catalog entry, or null when no entries are registered.
   */
  activeEntryRead(): EntityBrowserCatalogEntry | null {
    if (this.activeEntryId === null) {
      return this.entries[0] ?? null;
    }
    return this.entries.find((e) => e.id === this.activeEntryId) ?? this.entries[0] ?? null;
  }

  /**
   * Sets the active catalog entry id for click-to-place.
   *
   * @param entryId Catalog entry id.
   */
  activeEntryIdWrite(entryId: string): void {
    this.isActiveEntryChosen = true;
    if (this.activeEntryId === entryId) {
      return;
    }
    this.activeEntryId = entryId;
    this.listenersNotify();
  }

  /**
   * Registers the viewport placement delegate used when clicking in a viewport.
   *
   * @param delegate Placement function, or null to clear.
   */
  placeDelegateWrite(
    delegate: ((entry: EntityBrowserCatalogEntry, clientX: number, clientY: number) => boolean) | null,
  ): void {
    this.placeDelegate = delegate;
  }

  /**
   * Places the active entity entry at a viewport client point (or calls
   * `entry.activate()` when no ray delegate is bound).
   *
   * @param clientX Viewport client X.
   * @param clientY Viewport client Y.
   * @returns True when an entity was placed.
   */
  placeAtClientPoint(clientX: number, clientY: number): boolean {
    const entry = this.activeEntryRead();
    if (!entry) {
      return false;
    }
    if (this.placeDelegate) {
      return this.placeDelegate(entry, clientX, clientY);
    }
    entry.activate();
    return true;
  }

  /**
   * Subscribes to Entity tool state changes.
   *
   * @param listener Callback invoked on change.
   * @returns Unsubscribe function.
   */
  changeListenerAdd(listener: StateEntityPlaceListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Invokes all registered listeners. */
  private listenersNotify(): void {
    this.listeners.forEach((listener) => listener());
  }
}

let sharedEntityPlaceState: StateEntityPlace | null = null;

/**
 * Returns the process-wide Entity tool placement state singleton.
 *
 * @returns Shared StateEntityPlace.
 */
export function getStateEntityPlace(): StateEntityPlace {
  if (!sharedEntityPlaceState) {
    sharedEntityPlaceState = new StateEntityPlace();
  }
  return sharedEntityPlaceState;
}

/**
 * Replaces the shared Entity tool state for unit tests.
 *
 * @param state State to install, or null to reset.
 */
export function setStateEntityPlaceForTests(state: StateEntityPlace | null): void {
  sharedEntityPlaceState = state;
}
