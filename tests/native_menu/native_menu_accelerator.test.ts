import { describe, expect, it } from 'vitest';
import {
  nativeMenuAcceleratorFromShortcut,
  nativeMenuAcceleratorKeyName,
} from '@/native_menu/native_menu_accelerator.js';
import { createDefaultKeyboardShortcutSettings } from '@/settings/store/settings_defaults.js';

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

  it('names letters, digits and special keys the way native menus expect', () => {
    expect(nativeMenuAcceleratorKeyName('KeyQ')).toBe('q');
    expect(nativeMenuAcceleratorKeyName('Digit7')).toBe('7');
    expect(nativeMenuAcceleratorKeyName('Enter')).toBe('return');
    expect(nativeMenuAcceleratorKeyName('F13')).toBeNull();
  });
});
