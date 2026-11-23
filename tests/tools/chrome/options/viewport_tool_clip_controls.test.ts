import { describe, it, expect, vi, afterEach } from 'vitest';
import { ViewportToolClipControls } from '@/tools/chrome/options/viewport_tool_clip_controls.js';
import { CLIP_KEEP_MODE_CYCLE_ORDER, ClipKeepMode } from '@/tools/clip_plane/clip_keep_mode.js';

/**
 * Returns the keep mode buttons of the controls in display order.
 *
 * @param controls Clip controls.
 * @returns Buttons with their keep mode.
 */
function keepModeButtonsRead(controls: ViewportToolClipControls): HTMLButtonElement[] {
  return Array.from(controls.elementRead().querySelectorAll<HTMLButtonElement>('button[data-clip-keep-mode]'));
}

/**
 * Returns the Apply button of the controls.
 *
 * @param controls Clip controls.
 * @returns Apply button, or undefined.
 */
function applyButtonRead(controls: ViewportToolClipControls): HTMLButtonElement | undefined {
  return Array.from(controls.elementRead().querySelectorAll('button')).find((button) => button.textContent === 'Apply');
}

afterEach(() => {
  document.body.replaceChildren();
});

/** Proves the clip tool options: one button per keep mode and an Apply button. */
describe('ViewportToolClipControls', () => {
  it('offers one button per keep mode in cycle order and runs the chosen mode', () => {
    const onClipKeepModeSet = vi.fn();
    const controls = new ViewportToolClipControls(document, { onClipKeepModeSet, onClipApply: vi.fn() });
    const buttons = keepModeButtonsRead(controls);
    expect(buttons.map((button) => button.dataset['clipKeepMode'])).toEqual([...CLIP_KEEP_MODE_CYCLE_ORDER]);
    buttons.forEach((button) => button.click());
    expect(onClipKeepModeSet.mock.calls.map((call) => call[0])).toEqual([...CLIP_KEEP_MODE_CYCLE_ORDER]);
    controls.dispose();
  });

  it('marks only the current keep mode as active', () => {
    const controls = new ViewportToolClipControls(document, { onClipKeepModeSet: vi.fn(), onClipApply: vi.fn() });
    controls.clipStateSet(true, ClipKeepMode.BOTH);
    const activeModes = keepModeButtonsRead(controls)
      .filter((button) => button.dataset['active'] === 'true')
      .map((button) => button.dataset['clipKeepMode']);
    expect(activeModes).toEqual([ClipKeepMode.BOTH]);
    controls.dispose();
  });

  it('enables Apply only once a plane is ready and runs it on click', () => {
    const onClipApply = vi.fn();
    const controls = new ViewportToolClipControls(document, { onClipKeepModeSet: vi.fn(), onClipApply });
    const apply = applyButtonRead(controls);
    expect(apply?.disabled).toBe(true);
    controls.clipStateSet(true, ClipKeepMode.SIDE_A);
    expect(apply?.disabled).toBe(false);
    apply?.click();
    expect(onClipApply).toHaveBeenCalledTimes(1);
    controls.dispose();
  });
});
