import { describe, expect, it, vi } from 'vitest';
import { DISPLACEMENT_ALPHA_MAX } from '@/displacement/model/displacement_types.js';
import { StateDisplacementSculpt } from '@/displacement/state/state_displacement_sculpt.js';

/** Shared Displacement tab settings. */
describe('StateDisplacementSculpt', () => {
  it('starts on the Select tool with Hammer paint defaults', () => {
    const settings = new StateDisplacementSculpt().settingsRead();
    expect(settings).toMatchObject({
      activeTool: 'select',
      effect: 'raise_lower',
      spatial: true,
      axis: 'face_normal',
      edge: 'soft',
      autoSew: false,
      continuousMouse: false,
      alphaValue: DISPLACEMENT_ALPHA_MAX,
    });
  });

  it('clamps the alpha value, notifies listeners and resets to defaults', () => {
    const state = new StateDisplacementSculpt();
    const listener = vi.fn();
    state.changeListenerAdd(listener);
    state.settingsWrite({ alphaValue: DISPLACEMENT_ALPHA_MAX * 2, activeTool: 'paint_alpha' });
    expect(state.settingsRead().alphaValue).toBe(DISPLACEMENT_ALPHA_MAX);
    state.settingsWrite({ alphaValue: -DISPLACEMENT_ALPHA_MAX });
    expect(state.settingsRead().alphaValue).toBe(0);
    expect(listener).toHaveBeenCalledTimes(2);
    state.reset();
    expect(state.settingsRead().activeTool).toBe('select');
    expect(state.settingsRead().alphaValue).toBe(DISPLACEMENT_ALPHA_MAX);
  });
});
