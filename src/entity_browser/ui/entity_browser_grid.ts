import type { EntityBrowserCatalogEntry } from '@/entity_browser/catalog/entity_browser_catalog_entry.js';
import type { EntityBrowserViewGroup } from '@/entity_browser/view/entity_browser_view_query.js';
import {
  entityBrowserStyleGroupGrid,
  entityBrowserStyleGroupHeader,
  entityBrowserStyleScroller,
} from '@/entity_browser/ui/entity_browser_styles.js';
import { ENTITY_BROWSER_TILE_ID_ATTRIBUTE, EntityBrowserTile } from '@/entity_browser/ui/entity_browser_tile.js';

/** What the tile grid reports to the browser. */
export interface EntityBrowserGridHost {
  /**
   * Adds an entry the way its Add menu entry does.
   *
   * @param entry Activated catalog entry.
   */
  entryActivate(entry: EntityBrowserCatalogEntry): void;
  /**
   * Starts following a press on a tile that may become a drag.
   *
   * @param entry Pressed catalog entry.
   * @param event Pointer press.
   */
  entryPress(entry: EntityBrowserCatalogEntry, event: PointerEvent): void;
  /**
   * Opens the right-click menu of a tile.
   *
   * @param entry Catalog entry of the tile.
   * @param clientX Client X of the click.
   * @param clientY Client Y of the click.
   */
  entryContextMenu(entry: EntityBrowserCatalogEntry, clientX: number, clientY: number): void;
  /**
   * Returns the rendered 3D image a tile shows instead of its icon.
   *
   * @param entry Catalog entry.
   * @returns Image data URL, or null to show the icon.
   */
  imageUrlResolve(entry: EntityBrowserCatalogEntry): string | null;
  /**
   * Reports that the selected tile changed.
   *
   * @param entry Selected catalog entry, or null when none is selected.
   */
  selectionChanged(entry: EntityBrowserCatalogEntry | null): void;
}

/**
 * Scrollable area showing the tiles, optionally under category headers. Click
 * selects a tile, double-click or Enter adds it.
 */
export class EntityBrowserGrid {
  readonly element: HTMLElement;
  private readonly host: EntityBrowserGridHost;
  private tiles = new Map<string, EntityBrowserTile>();
  private selectedEntryId: string | null = null;

  /**
   * Creates an empty, focusable tile area.
   *
   * @param ownerDocument Document that owns the area.
   * @param host Browser callbacks.
   */
  constructor(ownerDocument: Document, host: EntityBrowserGridHost) {
    this.host = host;
    this.element = ownerDocument.createElement('div');
    this.element.tabIndex = 0;
    this.element.setAttribute('role', 'listbox');
    this.element.setAttribute('aria-label', 'Entity Browser');
    entityBrowserStyleScroller(this.element);
    this.listenersAdd();
  }

  /**
   * Replaces the tiles with the given groups, keeping the selection when its
   * entry is still shown.
   *
   * @param groups Groups in display order.
   * @param usageCounts Instance count by entry id.
   */
  render(groups: readonly EntityBrowserViewGroup[], usageCounts: ReadonlyMap<string, number>): void {
    this.element.replaceChildren();
    this.tiles = new Map();
    for (const group of groups) {
      this.groupRender(group, usageCounts);
    }
    if (this.selectedEntryId !== null && !this.tiles.has(this.selectedEntryId)) {
      this.selectedEntryId = null;
    }
    this.tiles.get(this.selectedEntryId ?? '')?.selectedSet(true);
    this.host.selectionChanged(this.selectedEntryRead());
  }

  /**
   * Returns the selected entry.
   *
   * @returns Selected catalog entry, or null.
   */
  selectedEntryRead(): EntityBrowserCatalogEntry | null {
    return this.tiles.get(this.selectedEntryId ?? '')?.entry ?? null;
  }

  /**
   * Selects the tile of an entry and deselects the previous one.
   *
   * @param entryId Entry id, or null to clear the selection.
   */
  selectedEntrySet(entryId: string | null): void {
    this.tiles.get(this.selectedEntryId ?? '')?.selectedSet(false);
    this.selectedEntryId = entryId !== null && this.tiles.has(entryId) ? entryId : null;
    this.tiles.get(this.selectedEntryId ?? '')?.selectedSet(true);
    this.host.selectionChanged(this.selectedEntryRead());
  }

  /**
   * Returns the tile element of an entry.
   *
   * @param entryId Entry id.
   * @returns Tile element, or null when the entry is not shown.
   */
  tileElementFind(entryId: string): HTMLElement | null {
    return this.tiles.get(entryId)?.element ?? null;
  }

  /**
   * Returns the ids of the shown entries in display order.
   *
   * @returns Entry ids.
   */
  shownEntryIdsList(): string[] {
    return [...this.tiles.keys()];
  }

  /**
   * Adds one group: an optional header and its tile grid.
   *
   * @param group Group to show.
   * @param usageCounts Instance count by entry id.
   */
  private groupRender(group: EntityBrowserViewGroup, usageCounts: ReadonlyMap<string, number>): void {
    const ownerDocument = this.element.ownerDocument;
    if (group.title !== null) {
      const header = ownerDocument.createElement('div');
      header.textContent = group.title;
      entityBrowserStyleGroupHeader(header);
      this.element.appendChild(header);
    }
    const grid = ownerDocument.createElement('div');
    entityBrowserStyleGroupGrid(grid);
    for (const entry of group.entries) {
      const usageCount = usageCounts.get(entry.id) ?? 0;
      const tile = new EntityBrowserTile(ownerDocument, entry, usageCount, this.host.imageUrlResolve(entry));
      this.tiles.set(entry.id, tile);
      grid.appendChild(tile.element);
    }
    this.element.appendChild(grid);
  }

  /** Routes clicks, double-clicks, presses and Enter to the tiles. */
  private listenersAdd(): void {
    this.element.addEventListener('click', (event) => this.selectedEntrySet(this.tileEntryIdFromEvent(event)));
    this.element.addEventListener('dblclick', (event) => this.tileActivateFromEvent(event));
    this.element.addEventListener('pointerdown', (event) => this.tilePressFromEvent(event));
    this.element.addEventListener('keydown', (event) => this.keyPressed(event));
    this.element.addEventListener('contextmenu', (event) => this.tileContextMenuFromEvent(event));
  }

  /**
   * Selects the right-clicked tile and reports the click for its menu.
   *
   * @param event Context menu event.
   */
  private tileContextMenuFromEvent(event: MouseEvent): void {
    const entryId = this.tileEntryIdFromEvent(event);
    const entry = this.tiles.get(entryId ?? '')?.entry ?? null;
    if (entry === null) {
      return;
    }
    event.preventDefault();
    this.selectedEntrySet(entry.id);
    this.host.entryContextMenu(entry, event.clientX, event.clientY);
  }

  /**
   * Adds the double-clicked tile's entry.
   *
   * @param event Double-click.
   */
  private tileActivateFromEvent(event: MouseEvent): void {
    const entry = this.tiles.get(this.tileEntryIdFromEvent(event) ?? '')?.entry ?? null;
    if (entry !== null) {
      this.host.entryActivate(entry);
    }
  }

  /**
   * Reports a primary-button press on a tile.
   *
   * @param event Pointer press.
   */
  private tilePressFromEvent(event: PointerEvent): void {
    const entry = this.tiles.get(this.tileEntryIdFromEvent(event) ?? '')?.entry ?? null;
    if (entry !== null && event.button === 0) {
      this.host.entryPress(entry, event);
    }
  }

  /**
   * Adds the selected entry on Enter.
   *
   * @param event Key press.
   */
  private keyPressed(event: KeyboardEvent): void {
    const entry = this.selectedEntryRead();
    if (event.key !== 'Enter' || entry === null) {
      return;
    }
    event.preventDefault();
    this.host.entryActivate(entry);
  }

  /**
   * Returns the entry id of the tile an event happened on.
   *
   * @param event DOM event.
   * @returns Entry id, or null when the event was not on a tile.
   */
  private tileEntryIdFromEvent(event: Event): string | null {
    const target = event.target;
    if (!(target instanceof Element)) {
      return null;
    }
    return (
      target.closest(`[${ENTITY_BROWSER_TILE_ID_ATTRIBUTE}]`)?.getAttribute(ENTITY_BROWSER_TILE_ID_ATTRIBUTE) ?? null
    );
  }
}
