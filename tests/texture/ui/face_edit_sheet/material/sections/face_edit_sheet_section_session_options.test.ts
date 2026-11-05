import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  FACE_EDIT_SHEET_PICK_MODE_LABELS,
  FaceEditSheetSectionSessionOptions,
  faceEditSheetPickModeButtonText,
} from '@/texture/ui/face_edit_sheet/material/sections/face_edit_sheet_section_session_options.js';
import { FACE_EDIT_PICK_MODES, getStateFaceEditSession } from '@/texture/paint/state_face_edit_session.js';
import {
  faceEditSheetTestButtonRead,
  faceEditSheetTestHandlersAsSheetHandlers,
  faceEditSheetTestHandlersCreate,
  faceEditSheetTestStateReset,
} from '../../face_edit_sheet_test_support.js';

describe('FaceEditSheetSectionSessionOptions', () => {
  let section: FaceEditSheetSectionSessionOptions;
  let unsubscribe: () => void;

  beforeEach(() => {
    faceEditSheetTestStateReset();
    section = new FaceEditSheetSectionSessionOptions(
      faceEditSheetTestHandlersAsSheetHandlers(faceEditSheetTestHandlersCreate()),
    );
    unsubscribe = getStateFaceEditSession().changeListenerAdd(() => section.sessionSync());
    section.sessionSync();
    document.body.appendChild(section.elementRead());
  });

  afterEach(() => {
    unsubscribe();
    section.dispose();
    document.body.replaceChildren();
    faceEditSheetTestStateReset();
  });

  it('cycles every click mode in order and wraps around', () => {
    const modeButton = faceEditSheetTestButtonRead(section.elementRead(), 'Cycle click mode');
    const firstMode = getStateFaceEditSession().pickModeRead();
    const startIndex = FACE_EDIT_PICK_MODES.indexOf(firstMode);
    expect(modeButton.textContent).toBe(faceEditSheetPickModeButtonText(firstMode));
    for (let step = 1; step <= FACE_EDIT_PICK_MODES.length; step++) {
      modeButton.click();
      const expectedMode = FACE_EDIT_PICK_MODES[(startIndex + step) % FACE_EDIT_PICK_MODES.length];
      expect(getStateFaceEditSession().pickModeRead()).toBe(expectedMode);
      expect(modeButton.textContent).toBe(
        `Mode: ${expectedMode ? FACE_EDIT_SHEET_PICK_MODE_LABELS[expectedMode] : ''}`,
      );
    }
    expect(getStateFaceEditSession().pickModeRead()).toBe(firstMode);
  });

  it('shows a mode written elsewhere', () => {
    getStateFaceEditSession().pickModeWrite('apply');
    expect(faceEditSheetTestButtonRead(section.elementRead(), 'Cycle click mode').textContent).toBe(
      'Mode: Apply (texture only)',
    );
  });

  it('names the texture + values and Align to View modes like Hammer++', () => {
    expect(FACE_EDIT_SHEET_PICK_MODE_LABELS.apply_values).toBe('Apply (texture + values)');
    expect(FACE_EDIT_SHEET_PICK_MODE_LABELS.align_view).toBe('Align to View');
    getStateFaceEditSession().pickModeWrite('align_view');
    expect(faceEditSheetTestButtonRead(section.elementRead(), 'Cycle click mode').textContent).toBe(
      'Mode: Align to View',
    );
  });

  it('toggles Hide mask and reports it as pressed', () => {
    const hideMaskButton = faceEditSheetTestButtonRead(section.elementRead(), 'Hide mask');
    expect(hideMaskButton.getAttribute('aria-pressed')).toBe('false');
    hideMaskButton.click();
    expect(getStateFaceEditSession().hideMaskRead()).toBe(true);
    expect(hideMaskButton.getAttribute('aria-pressed')).toBe('true');
    hideMaskButton.click();
    expect(getStateFaceEditSession().hideMaskRead()).toBe(false);
  });

  it('keeps the Hide mask highlight after the pointer leaves the button', () => {
    const hideMaskButton = faceEditSheetTestButtonRead(section.elementRead(), 'Hide mask');
    const idleBackground = hideMaskButton.style.background;
    hideMaskButton.click();
    const pressedBackground = hideMaskButton.style.background;
    expect(pressedBackground).not.toBe(idleBackground);
    hideMaskButton.dispatchEvent(new MouseEvent('mouseenter'));
    hideMaskButton.dispatchEvent(new MouseEvent('mouseleave'));
    expect(hideMaskButton.style.background).toBe(pressedBackground);
  });

  it('writes and shows Treat as one', () => {
    const checkbox = section.elementRead().querySelector<HTMLInputElement>('input.face-edit-sheet-treat-as-one');
    checkbox?.click();
    expect(getStateFaceEditSession().treatAsOneRead()).toBe(true);
    getStateFaceEditSession().treatAsOneWrite(false);
    expect(checkbox?.checked).toBe(false);
  });
});
