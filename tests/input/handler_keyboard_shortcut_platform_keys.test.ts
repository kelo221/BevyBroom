import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ManagerInput } from '@/input/manager_input.js';
import { HandlerKeyboardShortcut } from '@/input/handler_keyboard_shortcut.js';
import { createDefaultKeyboardShortcutSettings } from '@/settings/store/settings_defaults.js';
import { platformKeyboardKeyMapCreate } from '@/platform/keyboard/platform_keyboard_key_map_current.js';
import type { PlatformKind } from '@/platform/platform_kind.js';

/**
 * Dispatches a keydown on the window and reports whether a handler claimed it.
 * The primary shortcut modifier is passed as ctrlKey because the test DOM runs
 * with the standard modifier map, where Control is the primary modifier.
 *
 * @param code Keyboard event code.
 * @param modifiers Modifier flags of the key press.
 * @returns True when the event was default-prevented.
 */
function keyPress(code: string, modifiers: Partial<KeyboardEventInit> = {}): boolean {
  const event = new KeyboardEvent('keydown', { code, key: code, cancelable: true, ...modifiers });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

describe('HandlerKeyboardShortcut with the platform key map', () => {
  let inputManager: ManagerInput;
  let handler: HandlerKeyboardShortcut | null = null;

  /**
   * Creates and registers a handler using the key map of a platform.
   *
   * @param platform Operating system family of the key map.
   * @returns Registered handler.
   */
  function handlerCreate(platform: PlatformKind): HandlerKeyboardShortcut {
    handler?.unregister();
    handler = new HandlerKeyboardShortcut(
      inputManager,
      createDefaultKeyboardShortcutSettings,
      platformKeyboardKeyMapCreate(platform),
    );
    handler.register();
    return handler;
  }

  beforeEach(() => {
    inputManager = new ManagerInput();
  });

  afterEach(() => {
    handler?.unregister();
    handler = null;
  });

  it('deletes the selection on the Mac delete key, on Command+delete and on Fn+Delete', () => {
    const onDelete = vi.fn();
    handlerCreate('mac').setOnDeleteSelected(onDelete);
    expect(keyPress('Backspace')).toBe(true);
    expect(keyPress('Backspace', { ctrlKey: true })).toBe(true);
    expect(keyPress('Delete')).toBe(true);
    expect(onDelete).toHaveBeenCalledTimes(3);
  });

  it('keeps Backspace unbound on Windows and Linux so only the Delete key deletes', () => {
    for (const platform of ['windows', 'linux'] as const) {
      const onDelete = vi.fn();
      handlerCreate(platform).setOnDeleteSelected(onDelete);
      expect(keyPress('Backspace')).toBe(false);
      expect(keyPress('Backspace', { ctrlKey: true })).toBe(false);
      expect(keyPress('Delete')).toBe(true);
      expect(onDelete).toHaveBeenCalledOnce();
    }
  });

  it('keeps the Edit Mode delete key deleting components on Mac while Command+delete dissolves', () => {
    const onDissolve = vi.fn();
    const onDeleteComponents = vi.fn();
    const macHandler = handlerCreate('mac');
    macHandler.setOnDeleteSelected(onDissolve);
    macHandler.setOnDeleteEditComponents(onDeleteComponents);
    macHandler.setOnComponentMode(
      () => undefined,
      () => true,
    );
    keyPress('Backspace');
    expect(onDeleteComponents).toHaveBeenCalledOnce();
    expect(onDissolve).not.toHaveBeenCalled();
    keyPress('Backspace', { ctrlKey: true });
    keyPress('Delete');
    expect(onDissolve).toHaveBeenCalledTimes(2);
    expect(onDeleteComponents).toHaveBeenCalledOnce();
  });

  it('does not let an alias fire when its modifiers differ from the press', () => {
    const onDelete = vi.fn();
    handlerCreate('mac').setOnDeleteSelected(onDelete);
    expect(keyPress('Backspace', { shiftKey: true })).toBe(false);
    expect(keyPress('Backspace', { altKey: true })).toBe(false);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('rotates face textures with Option+arrow on Mac in place of the page keys', () => {
    const onRotateCounterClockwise = vi.fn();
    const onRotateClockwise = vi.fn();
    const macHandler = handlerCreate('mac');
    macHandler.actionCallbackSet('face_uv_rotate_ccw', onRotateCounterClockwise);
    macHandler.actionCallbackSet('face_uv_rotate_cw', onRotateClockwise);
    expect(keyPress('ArrowUp', { altKey: true })).toBe(true);
    expect(keyPress('ArrowDown', { altKey: true })).toBe(true);
    expect(keyPress('PageUp')).toBe(true);
    expect(onRotateCounterClockwise).toHaveBeenCalledTimes(2);
    expect(onRotateClockwise).toHaveBeenCalledOnce();
    const windowsHandler = handlerCreate('windows');
    windowsHandler.actionCallbackSet('face_uv_rotate_ccw', onRotateCounterClockwise);
    expect(keyPress('ArrowUp', { altKey: true })).toBe(false);
    expect(onRotateCounterClockwise).toHaveBeenCalledTimes(2);
  });
});
