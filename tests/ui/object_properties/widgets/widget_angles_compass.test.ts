import { describe, expect, it, vi } from 'vitest';
import { WidgetAnglesCompass } from '@/ui/object_properties/widgets/widget_angles_compass.js';
import type { AnglesPitchYawRollPartial } from '@/ui/object_properties/widgets/angles/angles_pitch_yaw_roll.js';

/**
 * Returns the angles combo of the compass.
 *
 * @param compass Compass.
 * @returns Combo input element.
 */
function anglesCombo(compass: WidgetAnglesCompass): HTMLInputElement {
  const input = compass.getElement().querySelector<HTMLInputElement>('input[aria-label="Angles"]');
  if (!input) throw new Error('the compass has an angles combo');
  return input;
}

/**
 * Types text into the angles combo and commits it.
 *
 * @param compass Compass.
 * @param text Typed text.
 */
function anglesComboType(compass: WidgetAnglesCompass, text: string): void {
  const combo = anglesCombo(compass);
  combo.value = text;
  combo.dispatchEvent(new Event('change'));
}

/**
 * Clicks the dial at an offset from its center in view box units.
 *
 * @param compass Compass.
 * @param offsetRight Offset toward the right.
 * @param offsetDown Offset toward the bottom.
 */
function dialClick(compass: WidgetAnglesCompass, offsetRight: number, offsetDown: number): void {
  const dial = compass.dialRead();
  const rect = dial.getBoundingClientRect();
  const viewSize = Number(dial.getAttribute('width'));
  const pixelsPerUnit = rect.width > 0 ? rect.width / viewSize : 1;
  dial.dispatchEvent(
    new MouseEvent('click', {
      bubbles: true,
      clientX: rect.left + (viewSize / 2 + offsetRight) * pixelsPerUnit,
      clientY: rect.top + (viewSize / 2 + offsetDown) * pixelsPerUnit,
    }),
  );
}

/**
 * The compass shows the shared yaw, Up or Down in its combo, commits typed or
 * picked yaws and the Up and Down choices, and sets the yaw where the dial is
 * clicked.
 */
describe('WidgetAnglesCompass', () => {
  it('shows the shared yaw and leaves differing yaws mixed', () => {
    const compass = new WidgetAnglesCompass({ onAnglesCommit: vi.fn() });
    compass.anglesWrite([{ pitch: 0, yaw: 30, roll: 0 }]);
    expect(anglesCombo(compass).value).toBe('30');
    compass.anglesWrite([
      { pitch: 10, yaw: 30, roll: 0 },
      { pitch: 10, yaw: 60, roll: 0 },
    ]);
    expect(anglesCombo(compass).value).toBe('');
    expect(anglesCombo(compass).placeholder).not.toBe('');
    expect(compass.dialRead().getAttribute('aria-valuenow')).toBe('30');
  });

  it('shows Up and Down for objects pointing straight up or down', () => {
    const compass = new WidgetAnglesCompass({ onAnglesCommit: vi.fn() });
    compass.anglesWrite([{ pitch: 90, yaw: 0, roll: 0 }]);
    expect(anglesCombo(compass).value).toBe('Up');
    compass.anglesWrite([{ pitch: -90, yaw: 0, roll: 0 }]);
    expect(anglesCombo(compass).value).toBe('Down');
  });

  it('offers the four quarter turns and Up and Down as choices', () => {
    const compass = new WidgetAnglesCompass({ onAnglesCommit: vi.fn() });
    const options = [...compass.getElement().querySelectorAll('datalist option')].map(
      (option) => (option as HTMLOptionElement).value,
    );
    expect(options).toEqual(['0', '90', '180', '270', 'Up', 'Down']);
  });

  it('commits a typed yaw and keeps pitch and roll', () => {
    const commits: AnglesPitchYawRollPartial[] = [];
    const compass = new WidgetAnglesCompass({ onAnglesCommit: (edit) => commits.push(edit) });
    anglesComboType(compass, '135');
    expect(commits).toEqual([{ pitch: null, yaw: 135, roll: null }]);
  });

  it('points straight up or down from the Up and Down choices in any case', () => {
    const commits: AnglesPitchYawRollPartial[] = [];
    const compass = new WidgetAnglesCompass({ onAnglesCommit: (edit) => commits.push(edit) });
    anglesComboType(compass, 'Up');
    anglesComboType(compass, 'down');
    expect(commits.map((edit) => edit.pitch)).toEqual([90, -90]);
  });

  it('commits nothing for text that is no yaw and no choice', () => {
    const onAnglesCommit = vi.fn();
    const compass = new WidgetAnglesCompass({ onAnglesCommit });
    anglesComboType(compass, 'sideways');
    anglesComboType(compass, '');
    expect(onAnglesCommit).not.toHaveBeenCalled();
  });

  it('sets the yaw of the clicked dial direction and keeps pitch and roll', () => {
    const commits: AnglesPitchYawRollPartial[] = [];
    const compass = new WidgetAnglesCompass({ onAnglesCommit: (edit) => commits.push(edit) });
    dialClick(compass, -10, 0);
    dialClick(compass, 0, -10);
    expect(commits).toEqual([
      { pitch: null, yaw: 90, roll: null },
      { pitch: null, yaw: 0, roll: null },
    ]);
  });
});
