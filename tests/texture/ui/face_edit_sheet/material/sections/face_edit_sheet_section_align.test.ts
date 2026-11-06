import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  FaceEditSheetSectionAlign,
  faceEditSheetAlignModeRead,
} from '@/texture/ui/face_edit_sheet/material/sections/face_edit_sheet_section_align.js';
import type { FaceTextureAlign } from '@/texture/uv/face_texture_mapping.js';
import {
  faceEditSheetTestHandlersAsSheetHandlers,
  faceEditSheetTestHandlersCreate,
  faceEditSheetTestSelectionCreate,
  type FaceEditSheetTestHandlers,
} from '../../face_edit_sheet_test_support.js';

/** World-axis align presets that Hammer shows as World alignment. */
const ALIGN_PRESETS_WORLD: readonly FaceTextureAlign[] = ['auto', 'floor', 'wall', 'ceiling'];

/**
 * Finds the World or Face box.
 *
 * @param root Element to search.
 * @param mode Alignment of the box.
 * @returns Checkbox input.
 */
function alignCheckboxRead(root: HTMLElement, mode: 'world' | 'face'): HTMLInputElement {
  const checkbox = root.querySelector<HTMLInputElement>(`input[data-face-edit-sheet-align="${mode}"]`);
  if (!checkbox) {
    throw new Error(`align box not found: ${mode}`);
  }
  return checkbox;
}

describe('faceEditSheetAlignModeRead', () => {
  it('reads world-axis presets as World and the face preset as Face', () => {
    ALIGN_PRESETS_WORLD.forEach((align) => expect(faceEditSheetAlignModeRead(align)).toBe('world'));
    expect(faceEditSheetAlignModeRead('face')).toBe('face');
    expect(faceEditSheetAlignModeRead(null)).toBeNull();
  });
});

describe('FaceEditSheetSectionAlign', () => {
  let handlers: FaceEditSheetTestHandlers;
  let section: FaceEditSheetSectionAlign;

  beforeEach(() => {
    handlers = faceEditSheetTestHandlersCreate();
    section = new FaceEditSheetSectionAlign(faceEditSheetTestHandlersAsSheetHandlers(handlers));
    document.body.appendChild(section.elementRead());
  });

  afterEach(() => {
    section.dispose();
    document.body.replaceChildren();
  });

  it('checks the box matching the selection alignment, and neither when mixed', () => {
    const root = section.elementRead();
    section.selectionWrite(faceEditSheetTestSelectionCreate({ align: 'face' }));
    expect(alignCheckboxRead(root, 'face').checked).toBe(true);
    expect(alignCheckboxRead(root, 'world').checked).toBe(false);
    section.selectionWrite(faceEditSheetTestSelectionCreate({ align: 'wall' }));
    expect(alignCheckboxRead(root, 'world').checked).toBe(true);
    expect(alignCheckboxRead(root, 'face').checked).toBe(false);
    section.selectionWrite(faceEditSheetTestSelectionCreate({ align: null }));
    expect(alignCheckboxRead(root, 'world').checked).toBe(false);
    expect(alignCheckboxRead(root, 'face').checked).toBe(false);
  });

  it('aligns to the face or world presets when a box is clicked', () => {
    const root = section.elementRead();
    alignCheckboxRead(root, 'face').click();
    alignCheckboxRead(root, 'world').click();
    expect(handlers.onAlign.mock.calls).toEqual([['face'], ['auto']]);
  });

  it('acts like a radio pair: the shown alignment stays checked after a click', () => {
    const root = section.elementRead();
    handlers.onAlign.mockImplementation((align: FaceTextureAlign) =>
      section.selectionWrite(faceEditSheetTestSelectionCreate({ align })),
    );
    section.selectionWrite(faceEditSheetTestSelectionCreate({ align: 'auto' }));
    alignCheckboxRead(root, 'world').click();
    expect(alignCheckboxRead(root, 'world').checked).toBe(true);
    alignCheckboxRead(root, 'face').click();
    expect(alignCheckboxRead(root, 'face').checked).toBe(true);
    expect(alignCheckboxRead(root, 'world').checked).toBe(false);
  });

  it('keeps the previous boxes when the click changed nothing', () => {
    const root = section.elementRead();
    section.selectionWrite(faceEditSheetTestSelectionCreate({ align: 'auto' }));
    alignCheckboxRead(root, 'face').click();
    expect(alignCheckboxRead(root, 'face').checked).toBe(false);
    expect(alignCheckboxRead(root, 'world').checked).toBe(true);
  });
});
