import { describe, expect, it } from 'vitest';
import {
  POINTER_DOUBLE_CLICK_MAX_DISTANCE_PX,
  POINTER_DOUBLE_CLICK_MAX_INTERVAL_MS,
  PointerDoubleClickDetector,
} from '@/input/pointer_double_click_detector.js';

/**
 * Proves the shared double-click detector: two presses close in time and space
 * form a double-click, presses too far apart in time or space do not, and reset
 * forgets the last press.
 */
describe('PointerDoubleClickDetector', () => {
  const startMs = 10_000;
  const pressX = 120;
  const pressY = 80;

  it('reports the first press as a single click', () => {
    const detector = new PointerDoubleClickDetector();
    expect(detector.pressRegister(pressX, pressY, startMs)).toBe(false);
  });

  it('reports a second press within time and distance as a double-click', () => {
    const detector = new PointerDoubleClickDetector();
    detector.pressRegister(pressX, pressY, startMs);
    const secondMs = startMs + POINTER_DOUBLE_CLICK_MAX_INTERVAL_MS;
    const drift = POINTER_DOUBLE_CLICK_MAX_DISTANCE_PX;
    expect(detector.pressRegister(pressX + drift, pressY - drift, secondMs)).toBe(true);
  });

  it('does not pair presses further apart than the double-click interval', () => {
    const detector = new PointerDoubleClickDetector();
    detector.pressRegister(pressX, pressY, startMs);
    expect(detector.pressRegister(pressX, pressY, startMs + POINTER_DOUBLE_CLICK_MAX_INTERVAL_MS + 1)).toBe(false);
  });

  it('does not pair presses further apart than the double-click distance', () => {
    const detector = new PointerDoubleClickDetector();
    detector.pressRegister(pressX, pressY, startMs);
    const farX = pressX + POINTER_DOUBLE_CLICK_MAX_DISTANCE_PX + 1;
    expect(detector.pressRegister(farX, pressY, startMs + 1)).toBe(false);
  });

  it('forgets the last press on reset', () => {
    const detector = new PointerDoubleClickDetector();
    detector.pressRegister(pressX, pressY, startMs);
    detector.reset();
    expect(detector.pressRegister(pressX, pressY, startMs + 1)).toBe(false);
    expect(detector.pressRegister(pressX, pressY, startMs + 2)).toBe(true);
  });
});
