import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ManagerInput } from '@/input/manager_input.js';
import { HandlerKeyboardShortcut } from '@/input/handler_keyboard_shortcut.js';
import { createDefaultKeyboardShortcutSettings } from '@/settings/store/settings_defaults.js';
import type { KeyboardShortcutAction } from '@/settings/store/settings_types.js';

/**
 * Dispatches the configured default shortcut of one action on the window.
 *
 * @param action Shortcut action whose default binding is pressed.
 * @param repeat Whether the key event is an auto repeat.
 * @returns The dispatched keyboard event.
 */
function defaultShortcutPress(action: KeyboardShortcutAction, repeat: boolean = false): KeyboardEvent {
  const shortcut = createDefaultKeyboardShortcutSettings()[action];
  const event = new KeyboardEvent('keydown', {
    code: shortcut.code,
    ctrlKey: shortcut.ctrl,
    shiftKey: shortcut.shift,
    altKey: shortcut.alt,
    metaKey: shortcut.meta,
    repeat,
    cancelable: true,
  });
  window.dispatchEvent(event);
  return event;
}

describe('HandlerKeyboardShortcut registered action callbacks', () => {
  let inputManager: ManagerInput;
  let handler: HandlerKeyboardShortcut;

  beforeEach(() => {
    inputManager = new ManagerInput();
    handler = new HandlerKeyboardShortcut(inputManager);
    handler.register();
  });

  afterEach(() => {
    handler.unregister();
  });

  it('runs the callback of the action whose default shortcut is pressed and prevents the default', () => {
    const playStart = vi.fn();
    handler.actionCallbackSet('play_start', playStart);
    const event = defaultShortcutPress('play_start');
    expect(playStart).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
  });

  it('tells Space and Ctrl+Space apart so view cycle and view maximize never both run', () => {
    const viewCycle = vi.fn();
    const viewMaximize = vi.fn();
    handler.actionCallbackSet('view_cycle', viewCycle);
    handler.actionCallbackSet('view_maximize', viewMaximize);
    defaultShortcutPress('view_cycle');
    expect(viewCycle).toHaveBeenCalledOnce();
    expect(viewMaximize).not.toHaveBeenCalled();
    defaultShortcutPress('view_maximize');
    expect(viewCycle).toHaveBeenCalledOnce();
    expect(viewMaximize).toHaveBeenCalledOnce();
  });

  it('consumes auto repeated presses without running the callback again', () => {
    const viewCycle = vi.fn();
    handler.actionCallbackSet('view_cycle', viewCycle);
    defaultShortcutPress('view_cycle');
    const repeatedEvent = defaultShortcutPress('view_cycle', true);
    expect(viewCycle).toHaveBeenCalledOnce();
    expect(repeatedEvent.defaultPrevented).toBe(true);
  });

  it('stops running a callback once it is removed', () => {
    const playStart = vi.fn();
    handler.actionCallbackSet('play_start', playStart);
    handler.actionCallbackSet('play_start', null);
    const event = defaultShortcutPress('play_start');
    expect(playStart).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('does not run registered actions while right mouse fly navigation is held', () => {
    const viewCycle = vi.fn();
    handler.actionCallbackSet('view_cycle', viewCycle);
    window.dispatchEvent(new PointerEvent('pointerdown', { button: 2 }));
    defaultShortcutPress('view_cycle');
    expect(viewCycle).not.toHaveBeenCalled();
  });

  it('does not run registered actions while typing in a text field', () => {
    const viewCycle = vi.fn();
    handler.actionCallbackSet('view_cycle', viewCycle);
    const input = document.createElement('input');
    document.body.appendChild(input);
    const shortcut = createDefaultKeyboardShortcutSettings().view_cycle;
    input.dispatchEvent(new KeyboardEvent('keydown', { code: shortcut.code, bubbles: true }));
    expect(viewCycle).not.toHaveBeenCalled();
    input.remove();
  });
});
