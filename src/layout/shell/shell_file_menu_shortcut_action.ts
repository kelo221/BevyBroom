import type { KeyboardShortcutAction } from '@/settings/store/settings_types.js';

/**
 * Keyboard shortcut actions whose labels the File menu shows next to its
 * entries.
 */
export type ShellFileMenuShortcutAction = Extract<KeyboardShortcutAction, 'save' | 'save_as' | 'load' | 'export_glb'>;
