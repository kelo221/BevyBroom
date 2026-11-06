import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FaceEditSheetSectionTransform } from '@/texture/ui/face_edit_sheet/material/sections/face_edit_sheet_section_transform.js';
import {
  FACE_ATTRIBUTES_ROW_OFFSET,
  FACE_ATTRIBUTES_ROW_SCALE,
} from '@/texture/ui/face_attributes/face_attributes_field_specs.js';
import { INPUT_NUMERIC_MIXED_VALUE_DISPLAY } from '@/ui/input/input_numeric_parse.js';
import {
  faceEditSheetTestButtonRead,
  faceEditSheetTestHandlersAsSheetHandlers,
  faceEditSheetTestHandlersCreate,
  faceEditSheetTestSelectionCreate,
  type FaceEditSheetTestHandlers,
} from '../../face_edit_sheet_test_support.js';

/**
 * Finds the field of one spinner by its accessible name.
 *
 * @param root Element to search.
 * @param ariaLabel Accessible name of the field.
 * @returns Input element.
 */
function spinnerInputRead(root: HTMLElement, ariaLabel: string): HTMLInputElement {
  const input = root.querySelector<HTMLInputElement>(`input[aria-label="${ariaLabel}"]`);
  if (!input) {
    throw new Error(`field not found: ${ariaLabel}`);
  }
  return input;
}

describe('FaceEditSheetSectionTransform', () => {
  let handlers: FaceEditSheetTestHandlers;
  let section: FaceEditSheetSectionTransform;

  beforeEach(() => {
    handlers = faceEditSheetTestHandlersCreate();
    section = new FaceEditSheetSectionTransform(faceEditSheetTestHandlersAsSheetHandlers(handlers));
    document.body.appendChild(section.elementRead());
  });

  afterEach(() => {
    section.dispose();
    document.body.replaceChildren();
  });

  it('shows the Hammer captions for scale, shift and rotation', () => {
    const text = section.elementRead().textContent ?? '';
    expect(text).toContain('Texture scale:');
    expect(text).toContain('Texture shift:');
    expect(text).toContain('Rotation:');
  });

  it('commits only the typed field', () => {
    const scaleXSpec = FACE_ATTRIBUTES_ROW_SCALE.fields[0];
    if (!scaleXSpec) throw new Error('missing scale X spec');
    section.selectionWrite(faceEditSheetTestSelectionCreate());
    const input = spinnerInputRead(section.elementRead(), scaleXSpec.ariaLabel);
    input.value = '2.5';
    input.dispatchEvent(new Event('change'));
    expect(handlers.onApplyPartialTrs).toHaveBeenCalledWith({ [scaleXSpec.key]: 2.5 });
  });

  it('steps a shown value by the field step and commits it', () => {
    const shiftYSpec = FACE_ATTRIBUTES_ROW_OFFSET.fields[1];
    if (!shiftYSpec) throw new Error('missing shift Y spec');
    const shownShift = 0.5;
    section.selectionWrite(faceEditSheetTestSelectionCreate({ [shiftYSpec.key]: shownShift }));
    faceEditSheetTestButtonRead(section.elementRead(), `Increase ${shiftYSpec.ariaLabel}`).click();
    const committed = handlers.onApplyPartialTrs.mock.calls[0]?.[0] as Record<string, number> | undefined;
    expect(Object.keys(committed ?? {})).toEqual([shiftYSpec.key]);
    expect(committed?.[shiftYSpec.key]).toBeCloseTo(shownShift + shiftYSpec.step, 6);
  });

  it('shows mixed values as a dash that does not step', () => {
    const scaleYSpec = FACE_ATTRIBUTES_ROW_SCALE.fields[1];
    if (!scaleYSpec) throw new Error('missing scale Y spec');
    section.selectionWrite(faceEditSheetTestSelectionCreate({ [scaleYSpec.key]: null }));
    expect(spinnerInputRead(section.elementRead(), scaleYSpec.ariaLabel).value).toBe(INPUT_NUMERIC_MIXED_VALUE_DISPLAY);
    faceEditSheetTestButtonRead(section.elementRead(), `Increase ${scaleYSpec.ariaLabel}`).click();
    expect(handlers.onApplyPartialTrs).not.toHaveBeenCalled();
  });

  it('shifts that axis randomly from the X and Y buttons beside the shift fields', () => {
    faceEditSheetTestButtonRead(section.elementRead(), 'Shift X randomly').click();
    faceEditSheetTestButtonRead(section.elementRead(), 'Shift Y randomly').click();
    expect(handlers.onShiftRandom.mock.calls).toEqual([['u'], ['v']]);
    expect(handlers.onShiftFullTile).not.toHaveBeenCalled();
  });

  it('steps a hovered field with the mouse wheel and commits it', () => {
    const scaleXSpec = FACE_ATTRIBUTES_ROW_SCALE.fields[0];
    if (!scaleXSpec) throw new Error('missing scale X spec');
    const shownScale = 1.5;
    section.selectionWrite(faceEditSheetTestSelectionCreate({ [scaleXSpec.key]: shownScale }));
    const input = spinnerInputRead(section.elementRead(), scaleXSpec.ariaLabel);
    input.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true }));
    const committed = handlers.onApplyPartialTrs.mock.calls[0]?.[0] as Record<string, number> | undefined;
    expect(Object.keys(committed ?? {})).toEqual([scaleXSpec.key]);
    expect(committed?.[scaleXSpec.key]).toBeCloseTo(shownScale - scaleXSpec.step, 6);
  });
});
