import { getDefaultCheckerBrowserEntry } from '@/texture/library/default_checker_entry.js';
import { textureChoicesList } from '@/texture/library/texture_choices.js';
import { getTextureMapCache } from '@/texture/library/texture_map_cache.js';
import { Theme } from '@/theme.js';
import { InputSelect } from '@/ui/input/input_select.js';

/** Edge length of the texture thumbnail in CSS pixels. */
const INPUT_TEXTURE_THUMBNAIL_SIZE = 18;

/**
 * Picks a texture from the texture library: a thumbnail of the current texture
 * beside a list of every texture by name. Several objects with different
 * textures show no thumbnail and a blank list entry.
 */
export class InputTexture {
  private readonly element: HTMLElement;
  private readonly thumbnail: HTMLImageElement;
  private readonly select: InputSelect;
  private commitHandler: ((textureId: string) => void) | null;

  /**
   * Creates the input.
   *
   * @param ariaLabel Accessible name of the texture list.
   */
  constructor(ariaLabel: string) {
    this.commitHandler = null;
    this.thumbnail = InputTexture.thumbnailCreate();
    this.select = new InputSelect([], ariaLabel);
    this.select.getElement().style.flex = '1';
    this.select.getElement().style.minWidth = '0';
    this.select.bindCommit(() => this.choiceCommit());
    this.element = InputTexture.containerCreate();
    this.element.append(this.thumbnail, this.select.getElement());
  }

  /**
   * Returns the root element.
   *
   * @returns Container holding the thumbnail and the list.
   */
  getElement(): HTMLElement {
    return this.element;
  }

  /**
   * Shows the textures of the bound objects.
   *
   * @param textureIds Texture id of every bound object.
   */
  setSharedValues(textureIds: readonly string[]): void {
    this.select.setChoices(textureChoicesList(textureIds));
    this.select.setSharedValues(textureIds);
    const first = textureIds[0];
    const isShared = first !== undefined && textureIds.every((textureId) => textureId === first);
    this.thumbnailShow(isShared ? first : null);
  }

  /**
   * Binds the handler called with the texture the user picks.
   *
   * @param onCommit Receives the picked texture id.
   */
  bindCommit(onCommit: (textureId: string) => void): void {
    this.commitHandler = onCommit;
  }

  /** Hands the picked texture to the commit handler; a blank pick is ignored. */
  private choiceCommit(): void {
    const textureId = this.select.getValue();
    if (textureId !== '') {
      this.commitHandler?.(textureId);
    }
  }

  /**
   * Shows the thumbnail of a texture, or hides it.
   *
   * @param textureId Texture to show, or null to hide the thumbnail.
   */
  private thumbnailShow(textureId: string | null): void {
    this.thumbnail.style.visibility = textureId === null ? 'hidden' : 'visible';
    this.thumbnail.src = textureId === null ? '' : InputTexture.previewUrlOf(textureId);
    this.thumbnail.title = textureId ?? '';
  }

  /**
   * Returns the preview image of a texture.
   *
   * @param textureId Texture id.
   * @returns Preview URL of the library entry, or of the checker when the
   *   library does not hold the texture.
   */
  private static previewUrlOf(textureId: string): string {
    const entry = getTextureMapCache().getLibrary()?.getEntryById(textureId) ?? getDefaultCheckerBrowserEntry();
    return entry.previewObjectUrl;
  }

  /**
   * Creates the row that holds the thumbnail and the list.
   *
   * @returns Container element.
   */
  private static containerCreate(): HTMLElement {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.gap = '4px';
    container.style.minWidth = '0';
    return container;
  }

  /**
   * Creates the thumbnail image.
   *
   * @returns Image element.
   */
  private static thumbnailCreate(): HTMLImageElement {
    const thumbnail = document.createElement('img');
    thumbnail.width = INPUT_TEXTURE_THUMBNAIL_SIZE;
    thumbnail.height = INPUT_TEXTURE_THUMBNAIL_SIZE;
    thumbnail.alt = '';
    thumbnail.style.flex = 'none';
    thumbnail.style.objectFit = 'cover';
    thumbnail.style.border = `1px solid ${Theme.inputBorderColor}`;
    return thumbnail;
  }
}
