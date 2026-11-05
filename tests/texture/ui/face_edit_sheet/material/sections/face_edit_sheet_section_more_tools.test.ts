import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  FACE_EDIT_SHEET_MORE_TOOLS_UV_ROWS,
  FaceEditSheetSectionMoreTools,
} from '@/texture/ui/face_edit_sheet/material/sections/face_edit_sheet_section_more_tools.js';
import {
  FACE_ATTRIBUTES_ROW_OFFSET,
  FACE_ATTRIBUTES_ROW_SCALE,
} from '@/texture/ui/face_attributes/face_attributes_field_specs.js';
import { getStateFaceEditSession } from '@/texture/paint/state_face_edit_session.js';
import {
  faceEditSheetTestButtonRead,
  faceEditSheetTestHandlersAsSheetHandlers,
  faceEditSheetTestHandlersCreate,
  faceEditSheetTestSelectionCreate,
  faceEditSheetTestStateReset,
  type FaceEditSheetTestHandlers,
} from '../../face_edit_sheet_test_support.js';

/**
 * Builds a More tools section that follows the session like the sheet does.
 *
 * @param handlers Spy handlers.
 * @returns Section and the function that stops following the session.
 */
function moreToolsTestCreate(handlers: FaceEditSheetTestHandlers): {
  section: FaceEditSheetSectionMoreTools;
  unsubscribe: () => void;
} {
  const section = new FaceEditSheetSectionMoreTools(faceEditSheetTestHandlersAsSheetHandlers(handlers));
  const unsubscribe = getStateFaceEditSession().changeListenerAdd(() => section.sessionSync());
  section.sessionSync();
  document.body.appendChild(section.elementRead());
  return { section, unsubscribe };
}

describe('FaceEditSheetSectionMoreTools', () => {
  let handlers: FaceEditSheetTestHandlers;
  let built: Array<{ section: FaceEditSheetSectionMoreTools; unsubscribe: () => void }>;

  beforeEach(() => {
    faceEditSheetTestStateReset();
    handlers = faceEditSheetTestHandlersCreate();
    built = [];
  });

  afterEach(() => {
    built.forEach(({ section, unsubscribe }) => {
      unsubscribe();
      section.dispose();
    });
    document.body.replaceChildren();
    faceEditSheetTestStateReset();
  });

  it('starts collapsed and remembers the expanded state in the session', () => {
    const first = moreToolsTestCreate(handlers);
    built.push(first);
    expect(first.section.isExpanded()).toBe(false);
    faceEditSheetTestButtonRead(first.section.elementRead(), 'More tools').click();
    expect(getStateFaceEditSession().moreToolsExpandedRead()).toBe(true);
    expect(first.section.isExpanded()).toBe(true);
    const rebuilt = moreToolsTestCreate(handlers);
    built.push(rebuilt);
    expect(rebuilt.section.isExpanded()).toBe(true);
    faceEditSheetTestButtonRead(rebuilt.section.elementRead(), 'More tools').click();
    expect(first.section.isExpanded()).toBe(false);
    expect(rebuilt.section.isExpanded()).toBe(false);
  });

  it('keeps every extra UV tool reachable', () => {
    const created = moreToolsTestCreate(handlers);
    built.push(created);
    const root = created.section.elementRead();
    FACE_EDIT_SHEET_MORE_TOOLS_UV_ROWS.flat().forEach((spec) => faceEditSheetTestButtonRead(root, spec.title).click());
    expect(handlers.onFit.mock.calls).toEqual([['u'], ['v']]);
    expect(handlers.onAlignEdge.mock.calls).toEqual([['previous'], ['best'], ['next']]);
    expect(handlers.onFlip.mock.calls).toEqual([['horizontal'], ['vertical']]);
    expect(handlers.onRotate.mock.calls).toEqual([[-90], [90]]);
    expect(handlers.onResetFace).toHaveBeenCalledTimes(1);
    expect(handlers.onResetWorld).toHaveBeenCalledTimes(1);
  });

  it('offers whole-tile shifts and the offset and scale nudges', () => {
    const created = moreToolsTestCreate(handlers);
    built.push(created);
    const root = created.section.elementRead();
    faceEditSheetTestButtonRead(root, 'Tile -V').click();
    expect(handlers.onShiftFullTile).toHaveBeenCalledWith(0, -1);
    const nudges = [...FACE_ATTRIBUTES_ROW_OFFSET.fields, ...FACE_ATTRIBUTES_ROW_SCALE.fields].flatMap(
      (spec) => spec.nudges,
    );
    nudges.forEach((nudge) => faceEditSheetTestButtonRead(root, nudge.title).click());
    expect(handlers.onRelativeOp.mock.calls.map((call) => call[0])).toEqual(nudges.map((nudge) => nudge.op));
  });

  it('shows the shared shear values of the selection', () => {
    const created = moreToolsTestCreate(handlers);
    built.push(created);
    const shearU = 0.5;
    created.section.selectionWrite({ ...faceEditSheetTestSelectionCreate(), shearU });
    const shearInput = created.section.elementRead().querySelector<HTMLInputElement>('input[aria-label="Shear U"]');
    expect(Number.parseFloat(shearInput?.value ?? '')).toBeCloseTo(shearU, 6);
  });
});
