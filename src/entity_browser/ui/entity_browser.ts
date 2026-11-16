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
import {
  entityBrowserViewModeIs3d,
  type EntityBrowserViewOptions,
} from '@/entity_browser/view/entity_browser_view_options.js';
import type { EntityBrowserPreviewRendererFactory } from '@/entity_browser/preview/entity_browser_preview_renderer.js';
import { EntityBrowserPreviewRendererWebgl } from '@/entity_browser/preview/entity_browser_preview_renderer_webgl.js';
import { EntityBrowserPreviewStudio } from '@/entity_browser/preview/entity_browser_preview_studio.js';
import { EntityBrowserPreviewPane } from '@/entity_browser/ui/entity_browser_preview_pane.js';
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
  /** Creates the 3D preview renderer; a WebGL renderer when omitted. */
  readonly previewRendererFactory?: EntityBrowserPreviewRendererFactory;
}

/**
 * Entity browser: a grid of every placeable kind of the Add menu with view,
 * sort, group, used and search controls. Tiles show icons or each kind's meshes
 * rendered in 3D; the single 3D tile view adds a large orbitable 3D view of the
 * selected kind above the grid. Double-click or Enter adds a kind, dragging a
 * tile onto a viewport places it there.
 */
export class EntityBrowser {
  private readonly host: EntityBrowserHost;
  private readonly settingsStore: EntityBrowserSettingsStore;
  private readonly root: HTMLElement;
  private readonly grid: EntityBrowserGrid;
  private readonly controls: EntityBrowserControls;
  private readonly previewStudio: EntityBrowserPreviewStudio;
  private readonly previewPane: EntityBrowserPreviewPane;
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
    const rendererFactory = host.previewRendererFactory ?? EntityBrowserPreviewRendererWebgl.create;
    this.previewStudio = new EntityBrowserPreviewStudio(ownerDocument, rendererFactory);
    this.previewPane = new EntityBrowserPreviewPane(ownerDocument, this.previewStudio);
    this.grid = new EntityBrowserGrid(ownerDocument, {
      entryActivate: (entry) => entry.activate(),
      entryPress: (entry, event) => this.dragSessionStart(entry, event),
      imageUrlResolve: (entry) => (this.previewImagesShown() ? this.previewStudio.imageUrlResolve(entry) : null),
      selectionChanged: (entry) => this.previewPane.entryShow(entry),
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

  /**
   * Rebuilds the catalog and its 3D previews from the Add menu, recounts usage
   * and redraws.
   */
  refresh(): void {
    this.catalog = EntityBrowserCatalogBuilder.catalogBuild(this.host.addMenuActions);
    this.previewStudio.cacheClear();
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
   * Returns the single 3D tile view.
   *
   * @returns Preview pane; on screen only in the single 3D tile view.
   */
  previewPaneRead(): EntityBrowserPreviewPane {
    return this.previewPane;
  }

  /**
   * Selects the tile of an entry, which the single 3D tile view then shows.
   *
   * @param entryId Entry id, or null to clear the selection.
   */
  selectedEntrySet(entryId: string | null): void {
    this.grid.selectedEntrySet(entryId);
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
    this.previewPane.dispose();
    this.previewStudio.dispose();
    this.root.remove();
  }

  /**
   * Redraws the tiles and the single 3D tile for the current catalog, usage and
   * choices.
   */
  private render(): void {
    const options = this.settingsStore.optionsRead();
    const groups = EntityBrowserViewQuery.groupsResolve(this.catalog, options, this.usageCounts);
    this.previewPaneLayout(options.viewMode === 'single_3d');
    this.grid.render(groups, this.usageCounts);
    if (options.viewMode === 'single_3d' && this.grid.selectedEntryRead() === null) {
      this.grid.selectedEntrySet(this.grid.shownEntryIdsList()[0] ?? null);
    }
    this.previewPane.redraw();
  }

  /**
   * Returns whether tiles show rendered 3D images of their kinds.
   *
   * @returns True in the 3D tile and single 3D tile views.
   */
  private previewImagesShown(): boolean {
    return entityBrowserViewModeIs3d(this.settingsStore.optionsRead().viewMode);
  }

  /**
   * Puts the single 3D tile above the grid or takes it away.
   *
   * @param isShown True to show the single 3D tile.
   */
  private previewPaneLayout(isShown: boolean): void {
    const isMounted = this.previewPane.element.parentElement === this.root;
    if (isShown && !isMounted) {
      this.root.insertBefore(this.previewPane.element, this.grid.element);
    } else if (!isShown && isMounted) {
      this.previewPane.element.remove();
    }
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
