import { describe, expect, it } from 'vitest';
import {
  nativeMenuAcceleratorFromShortcut,
  nativeMenuAcceleratorKeyName,
} from '@/native_menu/native_menu_accelerator.js';
import { createDefaultKeyboardShortcutSettings } from '@/settings/store/settings_defaults.js';
import { platformKeyboardKeyMapCreate } from '@/platform/keyboard/platform_keyboard_key_map_current.js';

describe('native menu accelerators', () => {
  it('turns every primary modifier shortcut into a command key equivalent with its other modifiers', () => {
    const settings = createDefaultKeyboardShortcutSettings();
    const primaryShortcuts = Object.values(settings).filter(
      (shortcut) => shortcut.ctrl && nativeMenuAcceleratorKeyName(shortcut.code) !== null,
    );
    expect(primaryShortcuts.length).toBeGreaterThan(0);
    for (const shortcut of primaryShortcuts) {
      const accelerator = nativeMenuAcceleratorFromShortcut(shortcut) ?? '';
      const parts = accelerator.split('+');
      expect(parts[0]).toBe('command');
      expect(parts.includes('shift')).toBe(shortcut.shift);
      expect(parts.includes('option')).toBe(shortcut.alt);
      expect(parts[parts.length - 1]).toBe(nativeMenuAcceleratorKeyName(shortcut.code));
    }
  });

  it('gives plain keys no key equivalent so typing and map view keys keep working', () => {
    const plain = { code: 'KeyG', ctrl: false, shift: true, alt: false, meta: false };
    expect(nativeMenuAcceleratorFromShortcut(plain)).toBeUndefined();
    expect(nativeMenuAcceleratorFromShortcut(undefined)).toBeUndefined();
  });

  it('gives the Delete row the Command+delete key equivalent of its Mac alias, and none elsewhere', () => {
    const deleteShortcut = createDefaultKeyboardShortcutSettings().delete_selected;
    expect(deleteShortcut.code).toBe('Delete');
    expect(nativeMenuAcceleratorFromShortcut(deleteShortcut, platformKeyboardKeyMapCreate('mac'))).toBe(
      'command+backspace',
    );
    expect(nativeMenuAcceleratorFromShortcut(deleteShortcut, platformKeyboardKeyMapCreate('windows'))).toBeUndefined();
  });

  it('prefers the configured binding over its aliases when both have key equivalents', () => {
    const commandDelete = { code: 'Delete', ctrl: true, shift: true, alt: false, meta: false };
    const macMap = platformKeyboardKeyMapCreate('mac');
    expect(nativeMenuAcceleratorFromShortcut(commandDelete, macMap)).toBe('command+shift+backspace');
    const commandLetter = { code: 'KeyD', ctrl: true, shift: false, alt: false, meta: false };
    expect(nativeMenuAcceleratorFromShortcut(commandLetter, macMap)).toBe('command+d');
  });

  it('names letters, digits and special keys the way native menus expect', () => {
    expect(nativeMenuAcceleratorKeyName('KeyQ')).toBe('q');
    expect(nativeMenuAcceleratorKeyName('Digit7')).toBe('7');
    expect(nativeMenuAcceleratorKeyName('Enter')).toBe('return');
    expect(nativeMenuAcceleratorKeyName('F13')).toBeNull();
  });
});
