import type * as THREE from 'three';
import type { AddMenuActions } from '@/layout/setup/add_menu_entries.js';
import { EntityBrowserCatalogBuilder } from '@/entity_browser/catalog/entity_browser_catalog_builder.js';
import type { EntityBrowserCatalogEntry } from '@/entity_browser/catalog/entity_browser_catalog_entry.js';
import { EntityBrowserCatalogUsage } from '@/entity_browser/catalog/entity_browser_catalog_usage.js';
import { EntityBrowserDragSession } from '@/entity_browser/drag/entity_browser_drag_session.js';
import { EntityBrowserSettingsStore } from '@/entity_browser/state/entity_browser_settings_store.js';
import { EntityBrowserControls } from '@/entity_browser/ui/entity_browser_controls.js';
import { EntityBrowserGrid } from '@/entity_browser/ui/entity_browser_grid.js';
import { entityBrowserStyleRoot } from '@/entity_browser/ui/entity_browser_styles.js';
import type { EntityBrowserViewOptions } from '@/entity_browser/view/entity_browser_view_options.js';
import { EntityBrowserViewQuery } from '@/entity_browser/view/entity_browser_view_query.js';

/** What the entity browser needs from the editor. */
export interface EntityBrowserHost {
  /** Root of the map; its content is counted for the Used filter. */
  readonly worldObject: THREE.Object3D;
  /** Creation callbacks the Add menu entries call. */
  readonly addMenuActions: AddMenuActions;
  /**
   * Places an entry at a client point, typically a drop on a viewport.
   *
   * @param entry Catalog entry to add.
   * @param clientX Client X of the drop point.
   * @param clientY Client Y of the drop point.
   */
  entityPlace(entry: EntityBrowserCatalogEntry, clientX: number, clientY: number): void;
  /**
   * Returns whether dropping at a client point places the entry; every point
   * outside the browser counts when omitted.
   *
   * @param clientX Client X.
   * @param clientY Client Y.
   * @returns True over a placement target.
   */
  placementTargetCheck?(clientX: number, clientY: number): boolean;
  /** Store of the display choices; a local storage store when omitted. */
  readonly settingsStore?: EntityBrowserSettingsStore;
  /** Document that owns the browser; the global document when omitted. */
  readonly ownerDocument?: Document;
}

/**
 * Entity browser: a grid of every placeable kind of the Add menu with sort,
 * group, used and search controls. Double-click or Enter adds a kind, dragging
 * a tile onto a viewport places it there.
 */
export class EntityBrowser {
  private readonly host: EntityBrowserHost;
  private readonly settingsStore: EntityBrowserSettingsStore;
  private readonly root: HTMLElement;
  private readonly grid: EntityBrowserGrid;
  private readonly controls: EntityBrowserControls;
  private readonly disposeCallbacks: (() => void)[] = [];
  private catalog: EntityBrowserCatalogEntry[] = [];
  private usageCounts = new Map<string, number>();
  private dragSession: EntityBrowserDragSession | null = null;

  /**
   * Creates the browser and shows the current catalog.
   *
   * @param host Editor callbacks and services.
   */
  constructor(host: EntityBrowserHost) {
    this.host = host;
    this.settingsStore = host.settingsStore ?? new EntityBrowserSettingsStore();
    const ownerDocument = host.ownerDocument ?? document;
    this.root = ownerDocument.createElement('div');
    this.root.className = 'entity-browser';
    entityBrowserStyleRoot(this.root);
    this.grid = new EntityBrowserGrid(ownerDocument, {
      entryActivate: (entry) => entry.activate(),
      entryPress: (entry, event) => this.dragSessionStart(entry, event),
    });
    const options = this.settingsStore.optionsRead();
    this.controls = new EntityBrowserControls(ownerDocument, options, (changes) => this.optionsUpdate(changes));
    this.root.append(this.grid.element, this.controls.element);
    this.refresh();
  }

  /**
   * Returns the root element to mount.
   *
   * @returns Browser element.
   */
  getElement(): HTMLElement {
    return this.root;
  }

  /** Rebuilds the catalog from the Add menu, recounts usage and redraws. */
  refresh(): void {
    this.catalog = EntityBrowserCatalogBuilder.catalogBuild(this.host.addMenuActions);
    this.usageRefresh();
  }

  /** Recounts how often each kind is used in the map and redraws. */
  usageRefresh(): void {
    this.usageCounts = EntityBrowserCatalogUsage.countsResolve(this.host.worldObject, this.catalog);
    this.render();
  }

  /**
   * Returns the current display choices.
   *
   * @returns Display choices.
   */
  optionsRead(): EntityBrowserViewOptions {
    return this.settingsStore.optionsRead();
  }

  /**
   * Changes display choices, saves them and redraws.
   *
   * @param changes Choices to replace.
   */
  optionsUpdate(changes: Partial<EntityBrowserViewOptions>): void {
    const options = this.settingsStore.optionsUpdate(changes);
    this.controls.optionsShow(options);
    this.render();
  }

  /**
   * Returns the shown catalog entries in display order.
   *
   * @returns Entries.
   */
  shownEntriesList(): EntityBrowserCatalogEntry[] {
    const byId = new Map(this.catalog.map((entry) => [entry.id, entry]));
    return this.grid.shownEntryIdsList().flatMap((entryId) => byId.get(entryId) ?? []);
  }

  /**
   * Registers a callback run when the browser is disposed.
   *
   * @param callback Cleanup callback.
   */
  disposeCallbackAdd(callback: () => void): void {
    this.disposeCallbacks.push(callback);
  }

  /** Ends any drag, runs cleanup callbacks and removes the browser element. */
  dispose(): void {
    this.dragSession?.cancel();
    this.disposeCallbacks.splice(0).forEach((callback) => callback());
    this.root.remove();
  }

  /** Redraws the tiles for the current catalog, usage and choices. */
  private render(): void {
    const options = this.settingsStore.optionsRead();
    const groups = EntityBrowserViewQuery.groupsResolve(this.catalog, options, this.usageCounts);
    this.grid.render(groups, this.usageCounts);
  }

  /**
   * Follows a press on a tile that may become a drag onto a viewport.
   *
   * @param entry Pressed catalog entry.
   * @param event Pointer press.
   */
  private dragSessionStart(entry: EntityBrowserCatalogEntry, event: PointerEvent): void {
    this.dragSession?.cancel();
    this.dragSession = new EntityBrowserDragSession(
      {
        sourceElement: this.root,
        placementTargetCheck: (clientX, clientY) => this.host.placementTargetCheck?.(clientX, clientY) ?? true,
        drop: (droppedEntry, clientX, clientY) => this.host.entityPlace(droppedEntry, clientX, clientY),
        ended: () => (this.dragSession = null),
      },
      entry,
      event,
    );
  }
}
