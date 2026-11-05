import { describe, expect, it, vi } from 'vitest';
import {
  DISPLACEMENT_NOISE_SEED_DEFAULT,
  FACE_EDIT_PICK_MODES,
  StateFaceEditSession,
} from '@/texture/paint/state_face_edit_session.js';
import { StateTexturePaint } from '@/texture/paint/state_texture_paint.js';

describe('StateFaceEditSession and StateTexturePaint', () => {
  it('cycles pick modes in Hammer++ order and notifies listeners', () => {
    const session = new StateFaceEditSession();
    const listener = vi.fn();
    session.changeListenerAdd(listener);

    expect(FACE_EDIT_PICK_MODES).toEqual(['lift_select', 'lift', 'select', 'apply', 'apply_values', 'align_view']);
    expect(session.pickModeRead()).toBe(FACE_EDIT_PICK_MODES[0]);
    FACE_EDIT_PICK_MODES.slice(1).forEach((expectedMode) => {
      session.pickModeCycle();
      expect(session.pickModeRead()).toBe(expectedMode);
    });
    session.pickModeCycle();
    expect(session.pickModeRead()).toBe('lift_select');
    expect(listener).toHaveBeenCalledTimes(FACE_EDIT_PICK_MODES.length);
  });

  it('tracks treatAsOne, hideMask, sheetOpen, and activeTabId', () => {
    const session = new StateFaceEditSession();
    session.treatAsOneWrite(true);
    session.hideMaskWrite(true);
    session.sheetOpenWrite(true);
    session.activeTabIdWrite('displacement');
    expect(session.treatAsOneRead()).toBe(true);
    expect(session.hideMaskRead()).toBe(true);
    expect(session.sheetOpenRead()).toBe(true);
    expect(session.activeTabIdRead()).toBe('displacement');
  });

  it('stores the displacement noise seed as a non-negative integer and resets it', () => {
    const session = new StateFaceEditSession();
    const listener = vi.fn();
    session.changeListenerAdd(listener);
    session.displacementNoiseSeedWrite(12.6);
    expect(session.displacementNoiseSeedRead()).toBe(13);
    session.displacementNoiseSeedWrite(13);
    expect(listener).toHaveBeenCalledTimes(1);
    session.displacementNoiseSeedWrite(-4);
    expect(session.displacementNoiseSeedRead()).toBe(0);
    session.reset();
    expect(session.displacementNoiseSeedRead()).toBe(DISPLACEMENT_NOISE_SEED_DEFAULT);
  });

  it('keeps More tools collapsed by default, notifies once per change and resets it', () => {
    const session = new StateFaceEditSession();
    const listener = vi.fn();
    session.changeListenerAdd(listener);
    expect(session.moreToolsExpandedRead()).toBe(false);
    session.moreToolsExpandedWrite(true);
    session.moreToolsExpandedWrite(true);
    expect(session.moreToolsExpandedRead()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    session.reset();
    expect(session.moreToolsExpandedRead()).toBe(false);
  });

  it('notifies StateTexturePaint listeners when texture id changes', () => {
    const paint = new StateTexturePaint();
    const seen: string[] = [];
    paint.changeListenerAdd((id) => seen.push(id));
    paint.setLastTextureId('brick/brickwall034a');
    paint.setLastTextureId('brick/brickwall034a');
    expect(seen).toEqual(['brick/brickwall034a']);
  });
});
