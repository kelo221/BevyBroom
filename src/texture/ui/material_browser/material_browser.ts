import { Theme } from '@/theme.js';
import { hexToRgb } from '@/utils/utils_color.js';
import { InputText } from '@/ui/input/input_text.js';
import type { TextureBrowserEntry } from '@/texture/library/texture_browser_entry.js';
import {
  FACE_INSPECTOR_METRICS,
  faceInspectorButtonCreate,
  faceInspectorCaptionCreate,
} from '@/texture/ui/face_inspector/face_inspector_controls.js';
import type { MaterialBrowserView } from './material_browser_view.js';
import { materialBrowserFilterEntries } from './material_browser_filter.js';
import { materialBrowserTileCreate, materialBrowserTileSelectionPaint } from './material_browser_tile.js';
import { MaterialBrowserContextMenu } from './material_browser_context_menu.js';
import {
  MATERIAL_BROWSER_GRID_CLASS,
  MATERIAL_BROWSER_ROOT_CLASS,
  materialBrowserStylesheetEnsure,
} from './material_browser_styles.js';

/** Callbacks the material browser uses for user actions. */
export interface MaterialBrowserHandlers {
  onOpenFolder: () => void;
  onSelectTexture: (entryId: string) => void;
  /** Right-click actions of a material tile; supplying them enables the menu. */
  contextActions?: MaterialBrowserContextActions;
}

/** Right-click actions offered for one material tile. */
export interface MaterialBrowserContextActions {
  onSelectFacesUsingMaterial: (entry: TextureBrowserEntry) => void;
  onSelectObjectsUsingMaterial: (entry: TextureBrowserEntry) => void;
  onCopyName: (entry: TextureBrowserEntry) => void;
}

/**
 * Docked material browser: filter row with Open Folder, folder caption, a
 * scrolling thumbnail grid and a status caption. Fills its parent.
 */
export class MaterialBrowser implements MaterialBrowserView {
  private readonly element: HTMLElement;
  private readonly handlers: MaterialBrowserHandlers;
  private readonly filterInput: InputText;
  private readonly gridElement: HTMLElement;
  private readonly folderLabel: HTMLElement;
  private readonly statusLabel: HTMLElement;
  private readonly tileElements: Map<string, HTMLElement>;
  private allEntries: TextureBrowserEntry[];
  private selectedId: string | null;
  private readonly tileContextMenu: MaterialBrowserContextMenu | null;

  /**
   * Creates the material browser.
   *
   * @param handlers Open-folder and select callbacks.
   */
  constructor(handlers: MaterialBrowserHandlers) {
    materialBrowserStylesheetEnsure();
    this.handlers = handlers;
    this.element = document.createElement('div');
    this.filterInput = new InputText('Filter materials');
    this.gridElement = document.createElement('div');
    this.folderLabel = faceInspectorCaptionCreate('No folder open');
    this.statusLabel = faceInspectorCaptionCreate('');
    this.tileElements = new Map();
    this.allEntries = [];
    this.selectedId = null;
    this.tileContextMenu = handlers.contextActions
      ? new MaterialBrowserContextMenu(this.gridElement, handlers.contextActions)
      : null;
    this.rootStyleApply();
    this.gridStyleApply();
    this.element.append(this.filterRowCreate(), this.folderLabel, this.gridElement, this.statusLabel);
    this.gridRender();
  }

  /**
   * Returns the browser element.
   *
   * @returns Browser DOM node.
   */
  getElement(): HTMLElement {
    return this.element;
  }

  /**
   * Returns the scrolling thumbnail grid.
   *
   * @returns Grid element.
   */
  getGridElement(): HTMLElement {
    return this.gridElement;
  }

  /**
   * Replaces the listed materials and shows the ones matching the filter.
   *
   * @param entries Materials to list.
   * @param selectedId Currently selected entry id, or null.
   * @param folderName Opened folder name, or null.
   */
  setEntries(entries: TextureBrowserEntry[], selectedId: string | null, folderName: string | null): void {
    this.allEntries = entries.slice();
    this.selectedId = selectedId;
    this.folderLabel.textContent = folderName ? `Folder: ${folderName}` : 'No folder open';
    this.gridRender();
  }

  /**
   * Highlights the selected material without rebuilding the grid.
   *
   * @param selectedId Entry id to highlight, or null.
   */
  setSelectedId(selectedId: string | null): void {
    this.selectedId = selectedId;
    this.tileElements.forEach((tile, id) => materialBrowserTileSelectionPaint(tile, id === selectedId));
  }

  /**
   * Shows a status message such as loading or error text.
   *
   * @param message Status text.
   */
  setStatusMessage(message: string): void {
    this.statusLabel.textContent = message;
  }

  /**
   * Sets the filter text and shows only the matching materials.
   *
   * @param filterText Words every shown material name or path must contain.
   */
  setFilterText(filterText: string): void {
    this.filterInput.getElement().value = filterText;
    this.gridRender();
  }

  /** Forgets the tiles, closes the context menu, and detaches the element. */
  dispose(): void {
    this.tileElements.clear();
    this.tileContextMenu?.dispose();
    this.element.remove();
  }

  /** Lays the browser out as a column that fills its parent. */
  private rootStyleApply(): void {
    this.element.className = MATERIAL_BROWSER_ROOT_CLASS;
    this.element.style.display = 'flex';
    this.element.style.flexDirection = 'column';
    this.element.style.flex = '1 1 auto';
    this.element.style.minHeight = '0';
    this.element.style.width = '100%';
    this.element.style.boxSizing = 'border-box';
    this.element.style.overflow = 'hidden';
    this.element.style.background = hexToRgb(Theme.outlinerBackground);
    this.folderLabel.style.padding = `0 ${FACE_INSPECTOR_METRICS.paddingX}px`;
    this.statusLabel.style.padding = `${FACE_INSPECTOR_METRICS.gap}px ${FACE_INSPECTOR_METRICS.paddingX}px`;
    this.statusLabel.style.flexShrink = '0';
  }

  /** Makes the grid the scrolling part of the column. */
  private gridStyleApply(): void {
    this.gridElement.className = MATERIAL_BROWSER_GRID_CLASS;
    this.gridElement.style.padding = `${FACE_INSPECTOR_METRICS.paddingY}px ${FACE_INSPECTOR_METRICS.paddingX}px`;
    this.gridElement.style.flex = '1 1 auto';
    this.gridElement.style.minHeight = '0';
    this.gridElement.setAttribute('role', 'listbox');
    this.gridElement.setAttribute('aria-label', 'Material browser grid');
  }

  /**
   * Creates the row with the live filter field and the Open Folder button.
   *
   * @returns Filter row element.
   */
  private filterRowCreate(): HTMLElement {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.gap = `${FACE_INSPECTOR_METRICS.gap}px`;
    row.style.padding = `${FACE_INSPECTOR_METRICS.paddingY}px ${FACE_INSPECTOR_METRICS.paddingX}px`;
    row.style.flexShrink = '0';
    const filterElement = this.filterInput.getElement();
    filterElement.placeholder = 'Filter';
    filterElement.style.flex = '1 1 auto';
    filterElement.style.height = `${FACE_INSPECTOR_METRICS.controlHeight}px`;
    filterElement.addEventListener('input', () => this.gridRender());
    row.append(filterElement, this.openFolderButtonCreate());
    return row;
  }

  /**
   * Creates the button that opens a local material folder.
   *
   * @returns Button element.
   */
  private openFolderButtonCreate(): HTMLButtonElement {
    const button = faceInspectorButtonCreate({
      title: 'Open Folder',
      text: 'Open Folder…',
      widthPx: null,
      heightPx: FACE_INSPECTOR_METRICS.controlHeight,
      onClick: () => this.handlers.onOpenFolder(),
    });
    button.title = 'Open a local texture folder';
    return button;
  }

  /** Rebuilds the grid from the entries that match the filter. */
  private gridRender(): void {
    this.tileElements.clear();
    this.gridElement.replaceChildren();
    const shownEntries = materialBrowserFilterEntries(this.allEntries, this.filterInput.getValue());
    shownEntries.forEach((entry) => this.tileAppend(entry));
    if (shownEntries.length === 0) {
      this.gridElement.appendChild(this.emptyMessageCreate());
    }
    this.statusLabel.textContent = this.countStatusText(shownEntries.length);
  }

  /**
   * Appends one material tile and paints its selection.
   *
   * @param entry Material entry.
   */
  private tileAppend(entry: TextureBrowserEntry): void {
    const tile = materialBrowserTileCreate(entry, (entryId) => this.handlers.onSelectTexture(entryId));
    materialBrowserTileSelectionPaint(tile, entry.id === this.selectedId);
    this.tileContextMenuBind(tile, entry);
    this.tileElements.set(entry.id, tile);
    this.gridElement.appendChild(tile);
  }

  /**
   * Opens the material context menu on a tile's right click when actions are
   * supplied.
   *
   * @param tile Material tile element.
   * @param entry Material entry of the tile.
   */
  private tileContextMenuBind(tile: HTMLElement, entry: TextureBrowserEntry): void {
    if (!this.tileContextMenu) {
      return;
    }
    tile.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.tileContextMenu?.openForEntry(entry, event.clientX, event.clientY);
    });
  }

  /**
   * Creates the message shown when no tile is listed.
   *
   * @returns Message element spanning the grid.
   */
  private emptyMessageCreate(): HTMLElement {
    const text = this.allEntries.length === 0 ? 'Open a folder to browse textures' : 'No materials match the filter';
    const message = faceInspectorCaptionCreate(text);
    message.style.gridColumn = '1 / -1';
    message.style.textAlign = 'center';
    message.style.padding = '24px 8px';
    return message;
  }

  /**
   * Describes how many materials are shown.
   *
   * @param shownCount Number of listed tiles.
   * @returns Status text.
   */
  private countStatusText(shownCount: number): string {
    if (shownCount === this.allEntries.length) {
      return `${shownCount} texture(s)`;
    }
    return `${shownCount} of ${this.allEntries.length} texture(s)`;
  }
}
