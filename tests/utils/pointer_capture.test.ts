import { describe, expect, it, vi } from 'vitest';
import { pointerCaptureTry } from '@/utils/pointer_capture.js';

describe('pointerCaptureTry', () => {
  it('captures the pointer id on the element', () => {
    const element = document.createElement('canvas');
    const capture = vi.fn();
    element.setPointerCapture = capture;
    expect(pointerCaptureTry(element, 7)).toBe(true);
    expect(capture).toHaveBeenCalledWith(7);
  });

  it('returns false for a missing id and a capture throw', () => {
    const element = document.createElement('canvas');
    element.setPointerCapture = () => {
      throw new Error('capture failed');
    };
    expect(pointerCaptureTry(element)).toBe(false);
    expect(pointerCaptureTry(element, 1)).toBe(false);
  });
});
