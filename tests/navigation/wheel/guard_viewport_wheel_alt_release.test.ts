import { describe, expect, it, vi } from 'vitest';
import { GuardViewportWheelAltRelease } from '@/navigation/wheel/guard_viewport_wheel_alt_release.js';

/**
 * Dispatches a cancelable key release on the window.
 *
 * @param key Released KeyboardEvent.key.
 * @param code Released KeyboardEvent.code.
 * @returns The dispatched event.
 */
function keyReleaseDispatch(key: string, code: string): KeyboardEvent {
  const event = new KeyboardEvent('keyup', { key, code, cancelable: true });
  window.dispatchEvent(event);
  return event;
}

/**
 * Builds a wheel turn.
 *
 * @param altKey Whether Alt is held.
 * @returns Wheel event.
 */
function wheelTurnCreate(altKey: boolean): WheelEvent {
  return new WheelEvent('wheel', { deltaY: 1, altKey });
}

/** Listener registrations counted while a test body runs. */
interface WindowListenerBalance {
  added: number;
  removed: number;
}

/**
 * Counts listeners added to and removed from the window and its document while
 * a body runs.
 *
 * @param body Code that adds and removes listeners.
 * @returns Added and removed listener counts.
 */
function windowListenerBalanceMeasure(body: () => void): WindowListenerBalance {
  const spies = [
    vi.spyOn(window, 'addEventListener'),
    vi.spyOn(document, 'addEventListener'),
    vi.spyOn(window, 'removeEventListener'),
    vi.spyOn(document, 'removeEventListener'),
  ];
  body();
  const counts = spies.map((spy) => spy.mock.calls.length);
  spies.forEach((spy) => spy.mockRestore());
  return { added: (counts[0] ?? 0) + (counts[1] ?? 0), removed: (counts[2] ?? 0) + (counts[3] ?? 0) };
}

/** Swallowing the Alt release that follows an Alt+wheel gesture. */
describe('GuardViewportWheelAltRelease', () => {
  it('prevents only the next Alt release after an Alt+wheel turn', () => {
    const guard = new GuardViewportWheelAltRelease();
    guard.arm(wheelTurnCreate(true), window);
    const otherRelease = keyReleaseDispatch('Shift', 'ShiftLeft');
    const firstAltRelease = keyReleaseDispatch('Alt', 'AltRight');
    const secondAltRelease = keyReleaseDispatch('Alt', 'AltRight');
    expect(otherRelease.defaultPrevented).toBe(false);
    expect(firstAltRelease.defaultPrevented).toBe(true);
    expect(secondAltRelease.defaultPrevented).toBe(false);
  });

  it('stays unarmed for wheel turns without Alt or without a window', () => {
    const guard = new GuardViewportWheelAltRelease();
    guard.arm(wheelTurnCreate(false), window);
    guard.arm(wheelTurnCreate(true), null);
    expect(keyReleaseDispatch('Alt', 'AltLeft').defaultPrevented).toBe(false);
  });

  it('listens once per window however many turns arrive before the release', () => {
    const guard = new GuardViewportWheelAltRelease();
    guard.arm(wheelTurnCreate(true), window);
    guard.arm(wheelTurnCreate(true), window);
    expect(keyReleaseDispatch('Alt', 'AltLeft').defaultPrevented).toBe(true);
    expect(keyReleaseDispatch('Alt', 'AltLeft').defaultPrevented).toBe(false);
  });

  it('accepts a release whose code names an Alt key', () => {
    const guard = new GuardViewportWheelAltRelease();
    guard.arm(wheelTurnCreate(true), window);
    expect(keyReleaseDispatch('Unidentified', 'AltLeft').defaultPrevented).toBe(true);
    guard.arm(wheelTurnCreate(true), window);
    expect(keyReleaseDispatch('Unidentified', 'AltRight').defaultPrevented).toBe(true);
  });

  it('stops waiting when the window loses focus or visibility', () => {
    const guard = new GuardViewportWheelAltRelease();
    guard.arm(wheelTurnCreate(true), window);
    window.dispatchEvent(new Event('blur'));
    expect(keyReleaseDispatch('Alt', 'AltLeft').defaultPrevented).toBe(false);
    guard.arm(wheelTurnCreate(true), window);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(keyReleaseDispatch('Alt', 'AltLeft').defaultPrevented).toBe(false);
  });

  it('removes every listener it added once released, blurred or disarmed', () => {
    const guard = new GuardViewportWheelAltRelease();
    const balance = windowListenerBalanceMeasure(() => {
      guard.arm(wheelTurnCreate(true), window);
      keyReleaseDispatch('Alt', 'AltLeft');
      guard.arm(wheelTurnCreate(true), window);
      window.dispatchEvent(new Event('blur'));
      guard.arm(wheelTurnCreate(true), window);
      guard.disarmAll();
    });
    expect(balance.added).toBeGreaterThan(0);
    expect(balance.removed).toBe(balance.added);
  });

  it('reads the window of the element a wheel turn was dispatched to', () => {
    const element = document.createElement('div');
    let dispatchedWindow: Window | null = null;
    element.addEventListener('wheel', (event) => {
      dispatchedWindow = GuardViewportWheelAltRelease.eventWindowRead(event);
    });
    element.dispatchEvent(wheelTurnCreate(true));
    expect(dispatchedWindow).toBe(element.ownerDocument.defaultView);
    expect(GuardViewportWheelAltRelease.eventWindowRead(wheelTurnCreate(true))).toBeNull();
  });
});
