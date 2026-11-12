import { afterEach, describe, expect, it } from 'vitest';
import { createLayoutPlatformPointerRemap } from '@/layout/setup/layout_platform_pointer_input.js';
import { createDefaultMouseSettings } from '@/settings/store/settings_defaults.js';
import type { MouseSettings } from '@/settings/store/settings_types.js';
import type { PlatformPointerButtonRemap } from '@/platform/pointer/platform_pointer_button_remap.js';

describe('createLayoutPlatformPointerRemap', () => {
  const remaps: PlatformPointerButtonRemap[] = [];

  afterEach(() => {
    for (const remap of remaps.splice(0)) {
      remap.dispose();
    }
  });

  /**
   * Installs a remap reading the given mouse settings and presses Alt+left on a
   * fresh element.
   *
   * @param mouse Mouse settings the remap reads, or null before the store
   *   exists.
   * @returns Button the element saw on the press.
   */
  function altLeftPressButtonRead(mouse: MouseSettings | null): number {
    const remap = createLayoutPlatformPointerRemap(() => mouse);
    remaps.push(remap);
    remap.installOnWindow(window);
    const target = document.createElement('div');
    document.body.appendChild(target);
    let seenButton = -1;
    target.addEventListener('pointerdown', (event) => {
      seenButton = (event as PointerEvent).button;
    });
    target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, buttons: 1, altKey: true }));
    remap.dispose();
    target.remove();
    return seenButton;
  }

  it('emulates the middle button with Alt+left only when the mouse setting is on', () => {
    expect(altLeftPressButtonRead(null)).toBe(0);
    expect(altLeftPressButtonRead(createDefaultMouseSettings())).toBe(0);
    expect(altLeftPressButtonRead({ ...createDefaultMouseSettings(), altLeftDragEmulatesMiddleMouse: true })).toBe(1);
  });

  it('reads the setting live so toggling it needs no reinstall', () => {
    let mouse: MouseSettings = createDefaultMouseSettings();
    const remap = createLayoutPlatformPointerRemap(() => mouse);
    remaps.push(remap);
    remap.installOnWindow(window);
    const target = document.createElement('div');
    document.body.appendChild(target);
    const seen: number[] = [];
    target.addEventListener('pointerdown', (event) => seen.push((event as PointerEvent).button));
    const press = (pointerId: number): void => {
      target.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, button: 0, buttons: 1, altKey: true, pointerId }),
      );
      target.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, buttons: 0, pointerId }));
    };
    press(1);
    mouse = { ...mouse, altLeftDragEmulatesMiddleMouse: true };
    press(2);
    expect(seen).toEqual([0, 1]);
    target.remove();
  });
});
