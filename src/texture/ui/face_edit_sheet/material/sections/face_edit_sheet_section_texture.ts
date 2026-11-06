import { InputSelect, type InputSelectChoice } from '@/ui/input/input_select.js';
import { buttonCompactCreate } from '@/ui/button/button_compact.js';
import { getStateTexturePaint } from '@/texture/paint/state_texture_paint.js';
import {
  FACE_INSPECTOR_METRICS,
  faceInspectorCaptionCreate,
  faceInspectorPreviewImageWrite,
  faceInspectorPreviewThumbnailCreate,
} from '@/texture/ui/face_inspector/face_inspector_controls.js';
import { faceAttributesMaterialSizeTextRead } from '@/texture/ui/face_attributes/face_attributes_material_row.js';
import type { DialogFaceEditSheetHandlers } from '@/texture/ui/face_edit_sheet/face_edit_sheet_handlers.js';
import { FaceEditSheetSection } from './face_edit_sheet_section.js';

/** Edge length of the current texture thumbnail in pixels. */
const FACE_EDIT_SHEET_TEXTURE_THUMBNAIL_PX = 64;

/** Width of the Mark / Browse / Replace buttons in pixels. */
const FACE_EDIT_SHEET_TEXTURE_BUTTON_WIDTH_PX = 84;

/**
 * Builds the `Current texture:` caption text with the image size when known.
 *
 * @param sizeText `width×height` text, or null while unknown.
 * @returns Caption text.
 */
export function faceEditSheetCurrentTextureCaptionText(sizeText: string | null): string {
  return sizeText === null ? 'Current texture:' : `Current texture: ${sizeText}`;
}

/**
 * Texture block of the Material tab: the current texture thumbnail with Mark,
 * Browse and Replace beside it and Apply below it, then the `Current texture`
 * size caption over the list of known textures that sets the current texture.
 */
export class FaceEditSheetSectionTexture extends FaceEditSheetSection {
  private readonly thumbnail: HTMLElement;
  private readonly sizeCaption: HTMLElement;
  private readonly textureSelect: InputSelect;

  /**
   * Creates the thumbnail, the texture buttons and the texture list.
   *
   * @param handlers Face Edit Sheet action callbacks.
   */
  constructor(handlers: DialogFaceEditSheetHandlers) {
    super(handlers, 'face-edit-sheet-section-texture');
    this.thumbnail = faceInspectorPreviewThumbnailCreate(
      FACE_EDIT_SHEET_TEXTURE_THUMBNAIL_PX,
      'face-edit-sheet-texture-thumbnail',
      'Current texture preview',
    );
    this.sizeCaption = faceInspectorCaptionCreate(faceEditSheetCurrentTextureCaptionText(null));
    this.sizeCaption.classList.add('face-edit-sheet-current-texture');
    this.textureSelect = this.textureSelectCreate();
    this.element.style.display = 'flex';
    this.element.style.flexDirection = 'column';
    this.element.style.gap = `${FACE_INSPECTOR_METRICS.gap}px`;
    this.element.append(this.previewRowCreate(), this.sizeCaption, this.textureSelect.getElement());
  }

  /** Shows the thumbnail, size and list entry of the current texture. */
  override textureSync(): void {
    const textureId = this.currentTextureIdRead();
    const description = this.handlers.textureDescribe?.(textureId) ?? null;
    faceInspectorPreviewImageWrite(this.thumbnail, description?.previewObjectUrl ?? null);
    this.thumbnail.title = description?.displayName ?? textureId;
    this.sizeCaption.textContent = faceEditSheetCurrentTextureCaptionText(
      faceAttributesMaterialSizeTextRead(description),
    );
    this.textureChoicesRefresh();
  }

  /** Releases the texture list listener. */
  override dispose(): void {
    this.textureSelect.dispose();
  }

  /**
   * Reads the current texture id.
   *
   * @returns Current texture id.
   */
  private currentTextureIdRead(): string {
    return getStateTexturePaint().getLastTextureId();
  }

  /** Lists the known textures, keeping the current one listed and chosen. */
  private textureChoicesRefresh(): void {
    const textureId = this.currentTextureIdRead();
    const choices: InputSelectChoice[] = (this.handlers.texturesList?.() ?? []).map((texture) => ({
      value: texture.id,
      label: texture.displayName,
      title: texture.id,
    }));
    if (!choices.some((choice) => choice.value === textureId)) {
      choices.unshift({ value: textureId, label: textureId, title: textureId });
    }
    this.textureSelect.setChoices(choices);
    this.textureSelect.setSharedValues([textureId]);
  }

  /**
   * Creates the list of known textures that sets the current texture.
   *
   * @returns Texture list.
   */
  private textureSelectCreate(): InputSelect {
    const select = new InputSelect([], 'Current texture');
    select.getElement().classList.add('face-edit-sheet-texture-select');
    select.getElement().style.fontSize = FACE_INSPECTOR_METRICS.captionFontSize;
    select.getElement().style.padding = '2px 4px';
    select.getElement().addEventListener('focus', () => this.textureChoicesRefresh());
    select.bindCommit(() => this.currentTextureWrite(select.getValue()));
    return select;
  }

  /**
   * Makes a texture the current texture.
   *
   * @param textureId Texture to make current; ignored when empty.
   */
  private currentTextureWrite(textureId: string): void {
    if (textureId === '') {
      return;
    }
    getStateTexturePaint().setLastTextureId(textureId);
  }

  /**
   * Creates the top-aligned row of the thumbnail with Apply below it and the
   * Mark, Browse and Replace buttons stacked beside it.
   *
   * @returns Row element.
   */
  private previewRowCreate(): HTMLElement {
    const row = document.createElement('div');
    row.classList.add('face-edit-sheet-texture-preview-row');
    row.style.display = 'flex';
    row.style.alignItems = 'flex-start';
    row.style.gap = `${FACE_INSPECTOR_METRICS.gap + 4}px`;
    row.append(this.thumbnailColumnCreate(), this.textureButtonColumnCreate());
    return row;
  }

  /**
   * Creates the column of the thumbnail with the Apply button under it.
   *
   * @returns Column element.
   */
  private thumbnailColumnCreate(): HTMLElement {
    const applyButton = this.buttonCreate('Apply', 'face-edit-sheet-texture-apply', () =>
      this.handlers.onApplyTexture?.(this.currentTextureIdRead()),
    );
    applyButton.style.width = `${FACE_EDIT_SHEET_TEXTURE_THUMBNAIL_PX}px`;
    const column = this.stackColumnCreate();
    column.append(this.thumbnail, applyButton);
    return column;
  }

  /**
   * Creates an empty top-aligned column that keeps its children at their own
   * sizes.
   *
   * @returns Column element.
   */
  private stackColumnCreate(): HTMLElement {
    const column = document.createElement('div');
    column.style.display = 'flex';
    column.style.flexDirection = 'column';
    column.style.alignItems = 'flex-start';
    column.style.flex = '0 0 auto';
    column.style.gap = `${FACE_INSPECTOR_METRICS.gap + 2}px`;
    return column;
  }

  /**
   * Creates the column of the Mark, Browse and Replace buttons.
   *
   * @returns Column element.
   */
  private textureButtonColumnCreate(): HTMLElement {
    const column = this.stackColumnCreate();
    column.classList.add('face-edit-sheet-texture-button-column');
    column.append(
      this.buttonCreate('Mark…', 'face-edit-sheet-texture-mark', () =>
        this.handlers.onMarkFacesWithTexture?.(this.currentTextureIdRead()),
      ),
      this.buttonCreate('Browse…', 'face-edit-sheet-texture-browse', () => this.handlers.onBrowseMaterial?.()),
      this.buttonCreate('Replace…', 'face-edit-sheet-texture-replace', () =>
        this.handlers.onReplaceTexture?.(this.currentTextureIdRead()),
      ),
    );
    return column;
  }

  /**
   * Creates one texture action button.
   *
   * @param title Button text and accessible name.
   * @param className Class name of the button.
   * @param onClick Click handler.
   * @returns Button element.
   */
  private buttonCreate(title: string, className: string, onClick: () => void): HTMLButtonElement {
    const button = buttonCompactCreate({
      title,
      widthPx: FACE_EDIT_SHEET_TEXTURE_BUTTON_WIDTH_PX,
      heightPx: FACE_INSPECTOR_METRICS.controlHeight,
      onClick,
    });
    button.classList.add(className);
    return button;
  }
}
