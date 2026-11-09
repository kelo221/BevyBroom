import { describe, it, expect } from 'vitest';
import { EditorInputHeldButtons } from '@/editor/window/editor_input_held_buttons.js';

describe('EditorInputHeldButtons', () => {
  it('reports the buttons of the last recorded pointer event', () => {
    const heldButtons = new EditorInputHeldButtons();
    expect(heldButtons.isAnyHeld()).toBe(false);
    heldButtons.record(new PointerEvent('pointerdown', { button: 2, buttons: 2 }));
    expect(heldButtons.isAnyHeld()).toBe(true);
    heldButtons.record(new PointerEvent('pointerup', { button: 2, buttons: 0 }));
    expect(heldButtons.isAnyHeld()).toBe(false);
  });

  it('tells a fresh press from a press made while another button is held', () => {
    expect(EditorInputHeldButtons.isOtherButtonHeld(new PointerEvent('pointerdown', { button: 0, buttons: 1 }))).toBe(
      false,
    );
    expect(EditorInputHeldButtons.isOtherButtonHeld(new PointerEvent('pointerdown', { button: 2, buttons: 3 }))).toBe(
      true,
    );
    expect(EditorInputHeldButtons.isOtherButtonHeld(new PointerEvent('pointerdown', { button: 1, buttons: 4 }))).toBe(
      false,
    );
  });
});
