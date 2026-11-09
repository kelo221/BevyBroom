import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ManagerInput } from '@/input/manager_input.js';
import { HandlerKeyboardShortcut } from '@/input/handler_keyboard_shortcut.js';
import { createDefaultKeyboardShortcutSettings } from '@/settings/store/settings_defaults.js';
import type { KeyboardShortcutAction, KeyboardShortcutSettings } from '@/settings/store/settings_types.js';
import { getStateSprinkleTool } from '@/tools/sprinkle/state_sprinkle_tool.js';
import { SPRINKLE_RADIUS_MAX, SPRINKLE_RADIUS_MIN } from '@/tools/sprinkle/sprinkle_types.js';
import { sprinkleRadiusShortcutsRegister } from '@/tools/sprinkle/radius/sprinkle_radius_shortcut_bindings.js';

/** Keyboard pipeline and shortcut registration of one test. */
interface SprinkleShortcutRig {
  inputManager: ManagerInput;
  handler: HandlerKeyboardShortcut;
  unregister: () => void;
}

/** Rig of the running test. */
let sprinkleShortcutRig: SprinkleShortcutRig | null = null;

/** Shortcut settings the running test's handler reads. */
let sprinkleShortcutSettings: KeyboardShortcutSettings = createDefaultKeyboardShortcutSettings();

/**
 * Builds a keyboard handler listening on the window with the Sprinkle radius
 * shortcuts registered.
 *
 * @returns Test rig.
 */
function sprinkleShortcutRigCreate(): SprinkleShortcutRig {
  const inputManager = new ManagerInput();
  const handler = new HandlerKeyboardShortcut(inputManager, () => sprinkleShortcutSettings);
  handler.register();
  const unregister = sprinkleRadiusShortcutsRegister(handler);
  return { inputManager, handler, unregister };
}

/**
 * Presses the configured shortcut of an action on a target.
 *
 * @param action Shortcut action whose binding is pressed.
 * @param target Element receiving the key, or the window.
 * @returns The dispatched keyboard event.
 */
function sprinkleShortcutPress(action: KeyboardShortcutAction, target: EventTarget = window): KeyboardEvent {
  const shortcut = sprinkleShortcutSettings[action];
  const event = new KeyboardEvent('keydown', {
    code: shortcut.code,
    ctrlKey: shortcut.ctrl,
    shiftKey: shortcut.shift,
    altKey: shortcut.alt,
    metaKey: shortcut.meta,
    bubbles: true,
    cancelable: true,
  });
  target.dispatchEvent(event);
  window.dispatchEvent(new KeyboardEvent('keyup', { code: shortcut.code }));
  return event;
}

/**
 * Returns the configured Sprinkle radius.
 *
 * @returns Radius in meters.
 */
function sprinkleRadiusRead(): number {
  return getStateSprinkleTool().configRead().radius;
}

/** [ and ] halve and double the Sprinkle radius. */
describe('sprinkleRadiusShortcutsRegister', () => {
  beforeEach(() => {
    sprinkleShortcutSettings = createDefaultKeyboardShortcutSettings();
    sprinkleShortcutRig = sprinkleShortcutRigCreate();
    getStateSprinkleTool().toolActiveWrite(true);
  });

  afterEach(() => {
    sprinkleShortcutRig?.unregister();
    sprinkleShortcutRig?.handler.unregister();
    sprinkleShortcutRig?.inputManager.dispose();
    sprinkleShortcutRig = null;
    document.body.replaceChildren();
    getStateSprinkleTool().reset();
  });

  it('binds the bracket keys by default', () => {
    expect(sprinkleShortcutSettings.sprinkle_radius_shrink.code).toBe('BracketLeft');
    expect(sprinkleShortcutSettings.sprinkle_radius_grow.code).toBe('BracketRight');
  });

  it('halves the radius on shrink and doubles it on grow', () => {
    const radiusBefore = sprinkleRadiusRead();
    sprinkleShortcutPress('sprinkle_radius_shrink');
    expect(sprinkleRadiusRead()).toBeCloseTo(radiusBefore / 2, 9);
    sprinkleShortcutPress('sprinkle_radius_grow');
    sprinkleShortcutPress('sprinkle_radius_grow');
    expect(sprinkleRadiusRead()).toBeCloseTo(radiusBefore * 2, 9);
  });

  it('clamps the radius to the Sprinkle range', () => {
    getStateSprinkleTool().configPatch({ radius: SPRINKLE_RADIUS_MAX });
    sprinkleShortcutPress('sprinkle_radius_grow');
    expect(sprinkleRadiusRead()).toBe(SPRINKLE_RADIUS_MAX);
    getStateSprinkleTool().configPatch({ radius: SPRINKLE_RADIUS_MIN });
    sprinkleShortcutPress('sprinkle_radius_shrink');
    expect(sprinkleRadiusRead()).toBe(SPRINKLE_RADIUS_MIN);
  });

  it('changes nothing and leaves the keys unprevented while the Sprinkle tool is inactive', () => {
    getStateSprinkleTool().toolActiveWrite(false);
    const radiusBefore = sprinkleRadiusRead();
    const growPress = sprinkleShortcutPress('sprinkle_radius_grow');
    const shrinkPress = sprinkleShortcutPress('sprinkle_radius_shrink');
    expect(sprinkleRadiusRead()).toBe(radiusBefore);
    expect(growPress.defaultPrevented).toBe(false);
    expect(shrinkPress.defaultPrevented).toBe(false);
  });

  it('lets another action bound to the same key run while the Sprinkle tool is inactive', () => {
    sprinkleShortcutSettings = {
      ...sprinkleShortcutSettings,
      sprinkle_radius_grow: sprinkleShortcutSettings.play_start,
    };
    const playStart = vi.fn();
    sprinkleShortcutRig?.handler.actionCallbackSet('play_start', playStart);
    getStateSprinkleTool().toolActiveWrite(false);
    const radiusBefore = sprinkleRadiusRead();
    const press = sprinkleShortcutPress('play_start');
    expect(playStart).toHaveBeenCalledOnce();
    expect(press.defaultPrevented).toBe(true);
    expect(sprinkleRadiusRead()).toBe(radiusBefore);
  });

  it('leaves the keys to text inputs while typing', () => {
    const textInput = document.createElement('input');
    document.body.appendChild(textInput);
    const radiusBefore = sprinkleRadiusRead();
    const typedKey = sprinkleShortcutPress('sprinkle_radius_grow', textInput);
    expect(sprinkleRadiusRead()).toBe(radiusBefore);
    expect(typedKey.defaultPrevented).toBe(false);
  });

  it('follows a rebound shortcut', () => {
    sprinkleShortcutSettings = {
      ...sprinkleShortcutSettings,
      sprinkle_radius_grow: { code: 'Equal', ctrl: false, shift: true, alt: false, meta: false },
    };
    const radiusBefore = sprinkleRadiusRead();
    sprinkleShortcutPress('sprinkle_radius_grow');
    expect(sprinkleRadiusRead()).toBeCloseTo(radiusBefore * 2, 9);
  });

  it('stops changing the radius once unregistered', () => {
    sprinkleShortcutRig?.unregister();
    const radiusBefore = sprinkleRadiusRead();
    sprinkleShortcutPress('sprinkle_radius_grow');
    expect(sprinkleRadiusRead()).toBe(radiusBefore);
  });
});
