import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlatformPointerButtonRemap } from '@/platform/pointer/platform_pointer_button_remap.js';
import {
  PlatformPointerButtonRemapRuleMiddleEmulation,
  PlatformPointerButtonRemapRuleSecondaryClick,
} from '@/platform/pointer/platform_pointer_button_remap_rule.js';
import { platformPointerButtonMapCreate } from '@/platform/pointer/platform_pointer_button_map_current.js';
import {
  platformPointerButtonsRemap,
  platformPointerEventCloneWithButton,
} from '@/platform/pointer/platform_pointer_event_clone.js';
import type { PlatformKind } from '@/platform/platform_kind.js';

/** Pointer events a listener on the target saw, as type and button pairs. */
type SeenEvents = Array<{ type: string; button: number; buttons: number }>;

/**
 * Installs a remap for a platform on the window and records every pointer and
 * mouse event reaching a target element.
 *
 * @param platform Operating system family of the button map.
 * @param middleEmulationEnabled Whether Alt+left drag acts as the middle
 *   button.
 * @returns Target, recorded events and the remap.
 */
function remapRigCreate(
  platform: PlatformKind,
  middleEmulationEnabled = false,
): { target: HTMLElement; seen: SeenEvents; remap: PlatformPointerButtonRemap } {
  const target = document.createElement('div');
  document.body.appendChild(target);
  const seen: SeenEvents = [];
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'mousedown', 'mouseup']) {
    target.addEventListener(type, (event) => {
      const mouseEvent = event as MouseEvent;
      seen.push({ type, button: mouseEvent.button, buttons: mouseEvent.buttons });
    });
  }
  const remap = new PlatformPointerButtonRemap([
    new PlatformPointerButtonRemapRuleSecondaryClick(platformPointerButtonMapCreate(platform)),
    new PlatformPointerButtonRemapRuleMiddleEmulation(() => middleEmulationEnabled),
  ]);
  remap.installOnWindow(window);
  return { target, seen, remap };
}

/**
 * Dispatches a pointer event on an element.
 *
 * @param target Element receiving the event.
 * @param type Pointer event type.
 * @param init Button, buttons and modifier flags.
 * @returns The dispatched event.
 */
function pointerDispatch(target: HTMLElement, type: string, init: PointerEventInit): PointerEvent {
  const event = new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 7, ...init });
  target.dispatchEvent(event);
  return event;
}

describe('PlatformPointerButtonRemap', () => {
  const rigs: Array<{ remap: PlatformPointerButtonRemap; target: HTMLElement }> = [];

  afterEach(() => {
    for (const rig of rigs.splice(0)) {
      rig.remap.dispose();
      rig.target.remove();
    }
  });

  it('delivers a Control+click on macOS as a right button press, drag and release', () => {
    const rig = remapRigCreate('mac');
    rigs.push(rig);
    const press = pointerDispatch(rig.target, 'pointerdown', { button: 0, buttons: 1, ctrlKey: true });
    expect(press.defaultPrevented).toBe(true);
    expect(rig.remap.remappedButtonRead()).toBe(2);
    pointerDispatch(rig.target, 'pointermove', { button: -1, buttons: 1, ctrlKey: false });
    pointerDispatch(rig.target, 'pointerup', { button: 0, buttons: 0, ctrlKey: false });
    expect(rig.seen).toEqual([
      { type: 'pointerdown', button: 2, buttons: 2 },
      { type: 'mousedown', button: 2, buttons: 2 },
      { type: 'pointermove', button: -1, buttons: 2 },
      { type: 'pointerup', button: 2, buttons: 0 },
      { type: 'mouseup', button: 2, buttons: 0 },
    ]);
    expect(rig.remap.remappedButtonRead()).toBeNull();
  });

  it('leaves Control+click alone on Windows and Linux and never touches real right clicks', () => {
    for (const platform of ['windows', 'linux'] as const) {
      const rig = remapRigCreate(platform);
      rigs.push(rig);
      pointerDispatch(rig.target, 'pointerdown', { button: 0, buttons: 1, ctrlKey: true });
      pointerDispatch(rig.target, 'pointerup', { button: 0, buttons: 0, ctrlKey: true });
      pointerDispatch(rig.target, 'pointerdown', { button: 2, buttons: 2 });
      expect(rig.seen.map((entry) => `${entry.type}:${entry.button}`)).toEqual([
        'pointerdown:0',
        'pointerup:0',
        'pointerdown:2',
      ]);
      expect(rig.remap.remappedButtonRead()).toBeNull();
    }
  });

  it('leaves other pointers alone while one press is remapped', () => {
    const rig = remapRigCreate('mac');
    rigs.push(rig);
    pointerDispatch(rig.target, 'pointerdown', { button: 0, buttons: 1, ctrlKey: true, pointerId: 1 });
    pointerDispatch(rig.target, 'pointermove', { button: -1, buttons: 1, pointerId: 2 });
    expect(rig.seen[rig.seen.length - 1]).toEqual({ type: 'pointermove', button: -1, buttons: 1 });
    pointerDispatch(rig.target, 'pointercancel', { pointerId: 1 });
    expect(rig.remap.remappedButtonRead()).toBeNull();
  });

  it('emulates the middle button with Alt+left drag only while the setting is on', () => {
    const enabled = remapRigCreate('windows', true);
    rigs.push(enabled);
    pointerDispatch(enabled.target, 'pointerdown', { button: 0, buttons: 1, altKey: true });
    expect(enabled.seen[0]).toEqual({ type: 'pointerdown', button: 1, buttons: 4 });
    pointerDispatch(enabled.target, 'pointerup', { button: 0, buttons: 0, altKey: true });
    pointerDispatch(enabled.target, 'pointerdown', {
      button: 0,
      buttons: 1,
      altKey: true,
      ctrlKey: true,
      pointerId: 9,
    });
    expect(enabled.seen[enabled.seen.length - 1]).toEqual({ type: 'pointerdown', button: 0, buttons: 1 });
    enabled.remap.dispose();
    const disabled = remapRigCreate('windows', false);
    rigs.push(disabled);
    pointerDispatch(disabled.target, 'pointerdown', { button: 0, buttons: 1, altKey: true });
    expect(disabled.seen[0]).toEqual({ type: 'pointerdown', button: 0, buttons: 1 });
  });

  it('uninstalls from a window and ignores windows installed twice', () => {
    const rig = remapRigCreate('mac');
    rigs.push(rig);
    rig.remap.installOnWindow(window);
    rig.remap.uninstallFromWindow(window);
    pointerDispatch(rig.target, 'pointerdown', { button: 0, buttons: 1, ctrlKey: true });
    expect(rig.seen).toEqual([{ type: 'pointerdown', button: 0, buttons: 1 }]);
    expect(() => rig.remap.uninstallFromWindow(window)).not.toThrow();
  });

  it('moves the primary bit of the buttons field onto the replacement button', () => {
    expect(platformPointerButtonsRemap(1, 2)).toBe(2);
    expect(platformPointerButtonsRemap(1, 1)).toBe(4);
    expect(platformPointerButtonsRemap(1 | 4, 2)).toBe(2 | 4);
    expect(platformPointerButtonsRemap(0, 2)).toBe(0);
    expect(platformPointerButtonsRemap(2, 1)).toBe(2);
  });

  it('copies pointer identity, position and modifiers onto the remapped event', () => {
    const original = new PointerEvent('pointerdown', {
      pointerId: 3,
      pointerType: 'mouse',
      isPrimary: true,
      clientX: 40,
      clientY: 50,
      ctrlKey: true,
      shiftKey: true,
      button: 0,
      buttons: 1,
    });
    const copy = platformPointerEventCloneWithButton(original, 2, 2);
    expect(copy.type).toBe('pointerdown');
    expect(copy.pointerId).toBe(3);
    expect(copy.pointerType).toBe('mouse');
    expect(copy.clientX).toBe(40);
    expect(copy.clientY).toBe(50);
    expect(copy.ctrlKey).toBe(true);
    expect(copy.shiftKey).toBe(true);
    expect(copy.button).toBe(2);
    expect(copy.buttons).toBe(2);
    expect(copy.bubbles).toBe(true);
    expect(copy.cancelable).toBe(true);
  });

  it('treats a Control+click as a secondary click only in the macOS button map', () => {
    const press = { button: 0, ctrlKey: true, metaKey: false };
    expect(platformPointerButtonMapCreate('mac').secondaryButtonPressIs(press)).toBe(true);
    expect(platformPointerButtonMapCreate('mac').secondaryButtonPressIs({ ...press, button: 1 })).toBe(false);
    expect(platformPointerButtonMapCreate('mac').secondaryButtonPressIs({ ...press, ctrlKey: false })).toBe(false);
    expect(platformPointerButtonMapCreate('windows').secondaryButtonPressIs(press)).toBe(false);
    expect(vi.isMockFunction(platformPointerButtonMapCreate)).toBe(false);
  });
});
