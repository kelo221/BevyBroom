import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buttonCompactActiveRead } from '@/ui/button/button_compact.js';
import {
  FACE_EDIT_SHEET_JUSTIFY_CROSS_CELLS,
  FaceEditSheetSectionJustify,
} from '@/texture/ui/face_edit_sheet/material/sections/face_edit_sheet_section_justify.js';
import {
  faceEditSheetTestButtonRead,
  faceEditSheetTestHandlersAsSheetHandlers,
  faceEditSheetTestHandlersCreate,
  faceEditSheetTestSelectionCreate,
  faceEditSheetTestStatusCreate,
  type FaceEditSheetTestHandlers,
} from '../../face_edit_sheet_test_support.js';

/**
 * Finds the cross button showing a label.
 *
 * @param root Element to search.
 * @param label Visible label of the button.
 * @returns Button element.
 */
function crossButtonRead(root: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(root.querySelectorAll('button')).find((candidate) => candidate.textContent === label);
  if (!button) {
    throw new Error(`cross button not found: ${label}`);
  }
  return button;
}

describe('FaceEditSheetSectionJustify', () => {
  let handlers: FaceEditSheetTestHandlers;
  let section: FaceEditSheetSectionJustify;

  beforeEach(() => {
    handlers = faceEditSheetTestHandlersCreate();
    section = new FaceEditSheetSectionJustify(faceEditSheetTestHandlersAsSheetHandlers(handlers));
    document.body.appendChild(section.elementRead());
  });

  afterEach(() => {
    section.dispose();
    document.body.replaceChildren();
  });

  it('lays Fit / T / L C R / B out as a cross inside the Justify box', () => {
    const legend = section.elementRead().querySelector('legend');
    expect(legend?.textContent).toBe('Justify');
    const cellOf = (label: string) => FACE_EDIT_SHEET_JUSTIFY_CROSS_CELLS.find((cell) => cell.label === label);
    const top = cellOf('T');
    const center = cellOf('C');
    const left = cellOf('L');
    const right = cellOf('R');
    const bottom = cellOf('B');
    expect(top && center && left && right && bottom).toBeTruthy();
    expect(top?.column).toBe(center?.column);
    expect(bottom?.column).toBe(center?.column);
    expect(left?.row).toBe(center?.row);
    expect(right?.row).toBe(center?.row);
    expect((top?.row ?? 0) < (center?.row ?? 0)).toBe(true);
    expect((bottom?.row ?? 0) > (center?.row ?? 0)).toBe(true);
    expect((left?.column ?? 0) < (center?.column ?? 0)).toBe(true);
    expect((right?.column ?? 0) > (center?.column ?? 0)).toBe(true);
    FACE_EDIT_SHEET_JUSTIFY_CROSS_CELLS.forEach((cell) => {
      const button = crossButtonRead(section.elementRead(), cell.label);
      expect(button.style.gridRow).toBe(String(cell.row));
      expect(button.style.gridColumn).toBe(String(cell.column));
    });
  });

  it('maps every cross button to its fit or justify action', () => {
    const root = section.elementRead();
    crossButtonRead(root, 'Fit').click();
    crossButtonRead(root, 'T').click();
    crossButtonRead(root, 'L').click();
    crossButtonRead(root, 'C').click();
    crossButtonRead(root, 'R').click();
    crossButtonRead(root, 'B').click();
    expect(handlers.onFit.mock.calls).toEqual([['both']]);
    expect(handlers.onJustify.mock.calls).toEqual([['top'], ['left'], ['center'], ['right'], ['bottom']]);
  });

  it('highlights only the side the selected face already meets', () => {
    const root = section.elementRead();
    section.selectionWrite(
      faceEditSheetTestSelectionCreate({}, faceEditSheetTestStatusCreate({ justifiedLeft: true })),
    );
    const left = faceEditSheetTestButtonRead(root, 'Justify ←');
    const right = faceEditSheetTestButtonRead(root, 'Justify →');
    expect(buttonCompactActiveRead(left)).toBe(true);
    expect(buttonCompactActiveRead(right)).toBe(false);
    expect(left.style.background).not.toBe(right.style.background);
    expect(left.style.borderColor).not.toBe(right.style.borderColor);
    section.selectionWrite(faceEditSheetTestSelectionCreate({}, null));
    expect(buttonCompactActiveRead(left)).toBe(false);
    expect(left.style.background).toBe(right.style.background);
  });

  it('gives every cross button the same width and height', () => {
    const buttons = Array.from(section.elementRead().querySelectorAll('button'));
    expect(buttons.length).toBe(FACE_EDIT_SHEET_JUSTIFY_CROSS_CELLS.length);
    const firstButton = buttons[0];
    buttons.forEach((button) => {
      expect(button.style.width).toBe(firstButton?.style.width);
      expect(button.style.height).toBe(firstButton?.style.height);
    });
  });
});
