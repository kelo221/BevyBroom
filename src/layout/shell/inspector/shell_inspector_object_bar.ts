import { Theme } from '@/theme.js';
import { hexToRgb } from '@/utils/utils_color.js';
import { SelectionFilterMode } from '@/types/selection_filter_mode.js';
import { getStateSelectionFilter, type StateSelectionFilter } from '@/selection/filter/state_selection_filter.js';
import { getStateTexturePaint, type StateTexturePaint } from '@/texture/paint/state_texture_paint.js';
import {
  faceAttributesMaterialSizeTextRead,
  type FaceAttributesMaterialDescriber,
} from '@/texture/ui/face_attributes/face_attributes_material_row.js';
import {
  faceInspectorCaptionCreate,
  faceInspectorPreviewImageWrite,
  faceInspectorPreviewThumbnailCreate,
} from '@/texture/ui/face_inspector/face_inspector_controls.js';
import { buttonCompactCreate } from '@/ui/button/button_compact.js';

/** Filter button definitions in Hammer++ Object Bar order. */
const OBJECT_BAR_FILTER_MODES: ReadonlyArray<{ readonly mode: SelectionFilterMode; readonly label: string }> = [
  { mode: SelectionFilterMode.GROUPS, label: 'Groups' },
  { mode: SelectionFilterMode.OBJECTS, label: 'Objects' },
  { mode: SelectionFilterMode.SOLIDS, label: 'Solids' },
];

/** Edge length of the current texture thumbnail in pixels. */
const OBJECT_BAR_THUMBNAIL_PX = 48;

/** Actions the Current texture row of the Object Bar runs. */
export interface ShellInspectorObjectBarHandlers {
  /** Opens the texture browser. */
  textureBrowse: () => void;
  /**
   * Opens the texture replacement for a texture.
   *
   * @param textureId Texture to replace.
   */
  textureReplace: (textureId: string) => void;
  /** Looks up the name, preview and size of a texture. */
  textureDescribe: FaceAttributesMaterialDescriber;
}

/** Elements of the Current texture row that change with the texture. */
interface ShellInspectorObjectBarTextureParts {
  readonly thumbnail: HTMLElement;
  readonly name: HTMLElement;
  readonly size: HTMLElement;
}

/**
 * Pinned Hammer++ Object Bar strip at the top of the right-hand inspector: the
 * Select (Groups / Objects / Solids) filter triad and the Current texture
 * thumbnail, name and size with Browse and Replace buttons.
 */
export class ShellInspectorObjectBar {
  private readonly root: HTMLElement;
  private readonly handlers: ShellInspectorObjectBarHandlers;
  private readonly filterState: StateSelectionFilter;
  private readonly paintState: StateTexturePaint;
  private readonly filterButtons: Map<SelectionFilterMode, HTMLButtonElement>;
  private readonly textureParts: ShellInspectorObjectBarTextureParts;
  private readonly unsubscribeFilter: () => void;
  private readonly unsubscribePaint: () => void;

  /**
   * Creates the pinned Object Bar strip.
   *
   * @param handlers Browse, Replace and texture lookup actions.
   * @param filterState Selection filter state store.
   * @param paintState Texture paint state store.
   */
  constructor(
    handlers: ShellInspectorObjectBarHandlers,
    filterState: StateSelectionFilter = getStateSelectionFilter(),
    paintState: StateTexturePaint = getStateTexturePaint(),
  ) {
    this.handlers = handlers;
    this.filterState = filterState;
    this.paintState = paintState;
    this.filterButtons = new Map();
    this.root = this.rootCreate();
    this.selectSectionMount();
    this.textureParts = this.textureSectionMount();
    this.filterButtonsRefresh();
    this.textureRefresh();
    this.unsubscribeFilter = this.filterState.changeListenerAdd(() => this.filterButtonsRefresh());
    this.unsubscribePaint = this.paintState.changeListenerAdd(() => this.textureRefresh());
  }

  /**
   * Returns the root DOM element of the Object Bar strip.
   *
   * @returns Root element.
   */
  getElement(): HTMLElement {
    return this.root;
  }

  /** Shows the name, thumbnail and size of the current texture again. */
  textureRefresh(): void {
    const textureId = this.paintState.getLastTextureId();
    const description = this.handlers.textureDescribe(textureId);
    this.textureParts.name.textContent = description?.displayName ?? textureId;
    this.textureParts.name.title = textureId;
    this.textureParts.size.textContent = faceAttributesMaterialSizeTextRead(description) ?? '';
    faceInspectorPreviewImageWrite(this.textureParts.thumbnail, description?.previewObjectUrl ?? null);
  }

  /** Unsubscribes state listeners and removes the strip element. */
  dispose(): void {
    this.unsubscribeFilter();
    this.unsubscribePaint();
    this.filterButtons.clear();
    this.root.remove();
  }

  /**
   * Creates and styles the outer strip container.
   *
   * @returns Root container element.
   */
  private rootCreate(): HTMLElement {
    const root = document.createElement('div');
    root.classList.add('shell-inspector-object-bar');
    root.style.display = 'flex';
    root.style.flexDirection = 'column';
    root.style.gap = '6px';
    root.style.padding = '6px 8px';
    root.style.flex = '0 0 auto';
    root.style.background = hexToRgb(Theme.toolbarBackground);
    root.style.borderBottom = `1px solid ${hexToRgb(Theme.separatorColor)}`;
    return root;
  }

  /** Builds and appends the Select (Groups / Objects / Solids) row. */
  private selectSectionMount(): void {
    const row = this.rowCreate('shell-inspector-select-filter');
    row.appendChild(faceInspectorCaptionCreate('Select:'));
    OBJECT_BAR_FILTER_MODES.forEach(({ mode, label }) => {
      const button = this.filterButtonCreate(mode, label);
      this.filterButtons.set(mode, button);
      row.appendChild(button);
    });
    this.root.appendChild(row);
  }

  /**
   * Creates a horizontal row of the strip.
   *
   * @param className Class name of the row.
   * @returns Row element.
   */
  private rowCreate(className: string): HTMLElement {
    const row = document.createElement('div');
    row.classList.add(className);
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '4px';
    row.style.minWidth = '0';
    return row;
  }

  /**
   * Creates one mode button for the Select filter triad.
   *
   * @param mode Selection filter mode.
   * @param label Button text.
   * @returns Configured button element.
   */
  private filterButtonCreate(mode: SelectionFilterMode, label: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.dataset['selectFilterMode'] = mode;
    button.style.flex = '1 1 0';
    button.style.padding = '3px 6px';
    button.style.fontSize = '11px';
    button.style.fontFamily = Theme.uiFontFamily;
    button.style.color = Theme.buttonTextColor;
    button.style.cursor = 'pointer';
    button.style.borderRadius = '3px';
    button.addEventListener('click', () => this.filterState.modeWrite(mode));
    return button;
  }

  /**
   * Builds and appends the Current texture caption, thumbnail row and buttons.
   *
   * @returns Elements that show the current texture.
   */
  private textureSectionMount(): ShellInspectorObjectBarTextureParts {
    const section = document.createElement('div');
    section.classList.add('shell-inspector-current-texture');
    section.style.display = 'flex';
    section.style.flexDirection = 'column';
    section.style.gap = '4px';
    const parts: ShellInspectorObjectBarTextureParts = {
      thumbnail: this.textureThumbnailCreate(),
      name: this.textureNameCreate(),
      size: this.textureSizeCreate(),
    };
    section.append(faceInspectorCaptionCreate('Current texture:'), this.textureRowCreate(parts));
    this.root.appendChild(section);
    return parts;
  }

  /**
   * Creates the row holding the thumbnail beside the name, size and buttons.
   *
   * @param parts Thumbnail, name and size elements.
   * @returns Row element.
   */
  private textureRowCreate(parts: ShellInspectorObjectBarTextureParts): HTMLElement {
    const row = this.rowCreate('shell-inspector-current-texture-row');
    row.style.alignItems = 'stretch';
    row.style.gap = '6px';
    const column = document.createElement('div');
    column.style.display = 'flex';
    column.style.flexDirection = 'column';
    column.style.justifyContent = 'space-between';
    column.style.flex = '1 1 auto';
    column.style.minWidth = '0';
    column.append(parts.name, parts.size, this.textureButtonsRowCreate());
    row.append(parts.thumbnail, column);
    return row;
  }

  /**
   * Creates the checker-backed square texture thumbnail.
   *
   * @returns Thumbnail element.
   */
  private textureThumbnailCreate(): HTMLElement {
    return faceInspectorPreviewThumbnailCreate(
      OBJECT_BAR_THUMBNAIL_PX,
      'shell-inspector-current-texture-thumbnail',
      'Current texture preview',
    );
  }

  /**
   * Creates the current texture name label.
   *
   * @returns Name element.
   */
  private textureNameCreate(): HTMLElement {
    const name = document.createElement('span');
    name.classList.add('shell-inspector-current-texture-name');
    name.style.overflow = 'hidden';
    name.style.textOverflow = 'ellipsis';
    name.style.whiteSpace = 'nowrap';
    name.style.fontSize = '11px';
    name.style.fontFamily = Theme.uiFontFamily;
    name.style.color = Theme.buttonTextColor;
    return name;
  }

  /**
   * Creates the `width×height` size label of the current texture.
   *
   * @returns Size element.
   */
  private textureSizeCreate(): HTMLElement {
    const size = faceInspectorCaptionCreate('');
    size.classList.add('shell-inspector-current-texture-size');
    return size;
  }

  /**
   * Creates the Browse and Replace button row.
   *
   * @returns Button row element.
   */
  private textureButtonsRowCreate(): HTMLElement {
    const row = this.rowCreate('shell-inspector-current-texture-actions');
    const browse = this.textureButtonCreate('Browse…', () => this.handlers.textureBrowse());
    browse.classList.add('shell-inspector-texture-browse');
    const replace = this.textureButtonCreate('Replace…', () =>
      this.handlers.textureReplace(this.paintState.getLastTextureId()),
    );
    replace.classList.add('shell-inspector-texture-replace');
    row.append(browse, replace);
    return row;
  }

  /**
   * Creates one compact text button of the Current texture row.
   *
   * @param label Button text.
   * @param onClick Click handler.
   * @returns Button element.
   */
  private textureButtonCreate(label: string, onClick: () => void): HTMLButtonElement {
    const button = buttonCompactCreate({ title: label, widthPx: null, heightPx: 20, onClick });
    button.style.flex = '1 1 0';
    return button;
  }

  /** Updates active styling on the Groups / Objects / Solids buttons. */
  private filterButtonsRefresh(): void {
    const activeMode = this.filterState.modeRead();
    this.filterButtons.forEach((button, mode) => {
      const isActive = mode === activeMode;
      button.dataset['active'] = String(isActive);
      button.style.background = hexToRgb(isActive ? Theme.selectionColor : Theme.buttonBackground);
      button.style.border = `1px solid ${isActive ? hexToRgb(Theme.selectionColor) : Theme.inputBorderColor}`;
    });
  }
}
