import { platformKindRead, type PlatformKind } from '@/platform/platform_kind.js';
import { platformKeyboardKeyMapCreate } from '@/platform/keyboard/platform_keyboard_key_map_current.js';
import { platformKeyboardModifierMapCreate } from '@/platform/keyboard/platform_keyboard_modifier_map_current.js';
import { formatKeyboardShortcutForPlatform } from '@/settings/keyboard/keyboard_shortcut_format.js';
import { createDefaultKeyboardShortcutSettings } from '@/settings/store/settings_defaults.js';
import type { KeyboardShortcut } from '@/settings/store/settings_types.js';
import { THEME_LOOK_CURRENT } from '@/theme/theme_look_current.js';
import type { ThemeLook } from '@/theme/theme_look.js';

/** What the editor adapted to the platform it runs on. */
export interface PlatformReport {
  /** Operating system family. */
  readonly platform: PlatformKind;
  /** Chrome look in use. */
  readonly themeLook: ThemeLook;
  /** Labels of every key binding that deletes the selection. */
  readonly deleteSelectionShortcuts: readonly string[];
}

/** Platform parts the report reads, replaceable in tests. */
export interface PlatformReportSources {
  readonly platform: PlatformKind;
  readonly themeLook: ThemeLook;
  readonly deleteSelectionShortcut: KeyboardShortcut;
}

/**
 * Returns the sources of the platform this page runs on, with the delete
 * binding the user configured.
 *
 * @param deleteSelectionShortcut Configured delete binding; defaults to the
 *   default binding.
 * @returns Live sources.
 */
export function platformReportSourcesCurrent(
  deleteSelectionShortcut: KeyboardShortcut = createDefaultKeyboardShortcutSettings().delete_selected,
): PlatformReportSources {
  return {
    platform: platformKindRead(),
    themeLook: THEME_LOOK_CURRENT,
    deleteSelectionShortcut,
  };
}

/**
 * Builds the platform report.
 *
 * @param sources Platform parts to read.
 * @returns Report.
 */
export function platformReportBuild(sources: PlatformReportSources): PlatformReport {
  const keyMap = platformKeyboardKeyMapCreate(sources.platform);
  const modifierMap = platformKeyboardModifierMapCreate(sources.platform);
  const bindings = keyMap.shortcutBindings(sources.deleteSelectionShortcut);
  return {
    platform: sources.platform,
    themeLook: sources.themeLook,
    deleteSelectionShortcuts: bindings.map((binding) =>
      formatKeyboardShortcutForPlatform(binding, modifierMap, keyMap),
    ),
  };
}
