import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  FaceEditSheetSectionTexture,
  faceEditSheetCurrentTextureCaptionText,
} from '@/texture/ui/face_edit_sheet/material/sections/face_edit_sheet_section_texture.js';
import { getStateTexturePaint } from '@/texture/paint/state_texture_paint.js';
import {
  faceEditSheetTestButtonRead,
  faceEditSheetTestHandlersAsSheetHandlers,
  faceEditSheetTestHandlersCreate,
  faceEditSheetTestStateReset,
  type FaceEditSheetTestHandlers,
} from '../../face_edit_sheet_test_support.js';

/** Known textures the test texture list offers. */
const TEXTURE_TEST_KNOWN = [
  { id: `test/brick_${Math.random().toString(36).slice(2)}`, displayName: 'Brick' },
  { id: `test/metal_${Math.random().toString(36).slice(2)}`, displayName: 'Metal' },
];

/**
 * Finds the texture list of the section.
 *
 * @param root Element to search.
 * @returns Select element.
 */
function textureSelectRead(root: HTMLElement): HTMLSelectElement {
  const select = root.querySelector<HTMLSelectElement>('select.face-edit-sheet-texture-select');
  if (!select) {
    throw new Error('texture list not found');
  }
  return select;
}

describe('FaceEditSheetSectionTexture', () => {
  let handlers: FaceEditSheetTestHandlers;
  let section: FaceEditSheetSectionTexture;
  let unsubscribe: () => void;

  beforeEach(() => {
    faceEditSheetTestStateReset();
    handlers = faceEditSheetTestHandlersCreate();
    handlers.texturesList.mockImplementation(() => TEXTURE_TEST_KNOWN);
    section = new FaceEditSheetSectionTexture(faceEditSheetTestHandlersAsSheetHandlers(handlers));
    unsubscribe = getStateTexturePaint().changeListenerAdd(() => section.textureSync());
    document.body.appendChild(section.elementRead());
  });

  afterEach(() => {
    unsubscribe();
    section.dispose();
    document.body.replaceChildren();
    faceEditSheetTestStateReset();
  });

  it('lists the known textures and keeps the current one listed and chosen', () => {
    const unknownCurrentId = `test/unknown_${Math.random().toString(36).slice(2)}`;
    getStateTexturePaint().setLastTextureId(unknownCurrentId);
    const select = textureSelectRead(section.elementRead());
    const values = Array.from(select.options).map((option) => option.value);
    TEXTURE_TEST_KNOWN.forEach((texture) => expect(values).toContain(texture.id));
    expect(values).toContain(unknownCurrentId);
    expect(select.value).toBe(unknownCurrentId);
  });

  it('sets the current texture when a texture is chosen in the list', () => {
    section.textureSync();
    const chosen = TEXTURE_TEST_KNOWN[1];
    if (!chosen) throw new Error('missing test texture');
    const select = textureSelectRead(section.elementRead());
    select.value = chosen.id;
    select.dispatchEvent(new Event('change'));
    expect(getStateTexturePaint().getLastTextureId()).toBe(chosen.id);
    expect(handlers.onApplyTexture).not.toHaveBeenCalled();
  });

  it('runs Apply, Mark, Browse and Replace with the current texture', () => {
    const current = TEXTURE_TEST_KNOWN[0];
    if (!current) throw new Error('missing test texture');
    getStateTexturePaint().setLastTextureId(current.id);
    const root = section.elementRead();
    faceEditSheetTestButtonRead(root, 'Apply').click();
    faceEditSheetTestButtonRead(root, 'Mark…').click();
    faceEditSheetTestButtonRead(root, 'Browse…').click();
    faceEditSheetTestButtonRead(root, 'Replace…').click();
    expect(handlers.onApplyTexture).toHaveBeenCalledWith(current.id);
    expect(handlers.onMarkFacesWithTexture).toHaveBeenCalledWith(current.id);
    expect(handlers.onBrowseMaterial).toHaveBeenCalledTimes(1);
    expect(handlers.onReplaceTexture).toHaveBeenCalledWith(current.id);
  });

  it('stacks Mark, Browse and Replace beside the thumbnail and puts Apply under it at their own heights', () => {
    const root = section.elementRead();
    const thumbnail = root.querySelector<HTMLElement>('.face-edit-sheet-texture-thumbnail');
    const buttonColumn = root.querySelector<HTMLElement>('.face-edit-sheet-texture-button-column');
    if (!thumbnail || !buttonColumn) throw new Error('missing thumbnail or button column');
    const thumbnailColumn = thumbnail.parentElement;
    expect(thumbnailColumn?.parentElement).toBe(buttonColumn.parentElement);
    expect(thumbnailColumn?.contains(faceEditSheetTestButtonRead(root, 'Apply'))).toBe(true);
    const stacked = ['Mark…', 'Browse…', 'Replace…'].map((title) => faceEditSheetTestButtonRead(root, title));
    stacked.forEach((button) => expect(button.parentElement).toBe(buttonColumn));
    expect(getComputedStyle(buttonColumn).alignItems).toBe('flex-start');
    expect(getComputedStyle(buttonColumn.parentElement ?? buttonColumn).alignItems).toBe('flex-start');
    const applyHeight = faceEditSheetTestButtonRead(root, 'Apply').style.height;
    [...stacked, faceEditSheetTestButtonRead(root, 'Apply')].forEach((button) => {
      expect(getComputedStyle(button).flexGrow).toBe('0');
      expect(getComputedStyle(button).flexBasis).toBe('auto');
      expect(button.style.height).toBe(applyHeight);
    });
  });

  it('shows the size of the current texture once known', () => {
    const size = { width: 128, height: 64 };
    handlers.textureDescribe.mockImplementation(() => ({
      displayName: 'Sized',
      previewObjectUrl: null,
      sizePixels: size,
    }));
    section.textureSync();
    const caption = section.elementRead().querySelector('.face-edit-sheet-current-texture');
    expect(caption?.textContent).toBe(faceEditSheetCurrentTextureCaptionText(`${size.width}×${size.height}`));
    handlers.textureDescribe.mockImplementation(() => null);
    section.textureSync();
    expect(caption?.textContent).toBe(faceEditSheetCurrentTextureCaptionText(null));
  });
});
