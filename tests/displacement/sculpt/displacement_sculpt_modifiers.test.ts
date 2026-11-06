import { describe, expect, it } from 'vitest';
import {
  StateDisplacementSculpt,
  type DisplacementSculptSettings,
} from '@/displacement/state/state_displacement_sculpt.js';
import {
  displacementSculptModifiersResizeIs,
  displacementSculptModifiersSettingsApply,
  type DisplacementSculptModifiers,
} from '@/displacement/sculpt/displacement_sculpt_modifiers.js';

/**
 * Builds default settings with some fields replaced.
 *
 * @param overrides Settings to replace.
 * @returns Settings.
 */
function modifiersTestSettings(overrides: Partial<DisplacementSculptSettings>): DisplacementSculptSettings {
  return { ...new StateDisplacementSculpt().settingsRead(), ...overrides };
}

/**
 * Builds press modifiers.
 *
 * @param isCtrlDown Ctrl held.
 * @param isShiftDown Shift held.
 * @param isSecondaryButton Right button pressed.
 * @returns Modifiers.
 */
function modifiersTestBuild(
  isCtrlDown: boolean,
  isShiftDown: boolean,
  isSecondaryButton: boolean,
): DisplacementSculptModifiers {
  return { isCtrlDown, isShiftDown, isSecondaryButton };
}

/** Hammer paint bindings resolved from keys and mouse button. */
describe('displacement sculpt modifiers', () => {
  it('inverts Raise for Ctrl or the right button and restores it for both together', () => {
    [true, false].forEach((raise) => {
      const settings = modifiersTestSettings({ activeTool: 'paint_geometry', raise });
      const apply = (modifiers: DisplacementSculptModifiers) =>
        displacementSculptModifiersSettingsApply(settings, modifiers).raise;
      expect(apply(modifiersTestBuild(false, false, false))).toBe(raise);
      expect(apply(modifiersTestBuild(true, false, false))).toBe(!raise);
      expect(apply(modifiersTestBuild(false, false, true))).toBe(!raise);
      expect(apply(modifiersTestBuild(true, false, true))).toBe(raise);
    });
  });

  it('turns Paint Geometry into Smooth while Shift is held and leaves Paint Alpha alone', () => {
    const geometry = modifiersTestSettings({ activeTool: 'paint_geometry', effect: 'noise' });
    const shift = modifiersTestBuild(false, true, false);
    expect(displacementSculptModifiersSettingsApply(geometry, shift).effect).toBe('smooth');
    expect(displacementSculptModifiersSettingsApply(geometry, modifiersTestBuild(false, false, false)).effect).toBe(
      'noise',
    );
    const alpha = modifiersTestSettings({ activeTool: 'paint_alpha', effect: 'noise' });
    expect(displacementSculptModifiersSettingsApply(alpha, shift).effect).toBe('noise');
    expect(geometry.effect).toBe('noise');
  });

  it('resizes only for Shift with the right button', () => {
    expect(displacementSculptModifiersResizeIs(modifiersTestBuild(false, true, true))).toBe(true);
    expect(displacementSculptModifiersResizeIs(modifiersTestBuild(true, true, true))).toBe(true);
    expect(displacementSculptModifiersResizeIs(modifiersTestBuild(false, true, false))).toBe(false);
    expect(displacementSculptModifiersResizeIs(modifiersTestBuild(false, false, true))).toBe(false);
  });
});
