import type { ToolbarMenuEntry, ToolbarMenuSubmenu } from '@/ui/menu/menu_types.js';
import { THEME_LOOK_STORED_SYSTEM, themeLookIsKnown, type ThemeLook } from '@/theme/theme_look.js';
import { themeLookSave, themeLookStoredValueRead } from '@/theme/theme_look_current.js';

/**
 * Look choice offered in the Look submenu: one look, or follow the system
 * appearance.
 */
export type ThemeLookMenuChoice = ThemeLook | typeof THEME_LOOK_STORED_SYSTEM;

/** Look choices in menu order. */
export const THEME_LOOK_MENU_CHOICES: readonly ThemeLookMenuChoice[] = Object.freeze([
  THEME_LOOK_STORED_SYSTEM,
  'mac_glass',
  'mac_glass_dark',
  'classic',
]);

/** Menu labels of the look choices. */
export const THEME_LOOK_MENU_LABELS: Readonly<Record<ThemeLookMenuChoice, string>> = Object.freeze({
  system: 'Automatic (Match System)',
  mac_glass: 'macOS Glass Light',
  mac_glass_dark: 'macOS Glass Dark',
  classic: 'Classic (Hammer)',
});

/** Callbacks the Look submenu runs, replaceable in tests. */
export interface ThemeLookMenuHooks {
  /** Choice the user saved, or follow the system when nothing is saved. */
  readonly savedChoice: ThemeLookMenuChoice;
  /** Saves the chosen look. */
  readonly lookSave: (choice: ThemeLookMenuChoice) => void;
  /** Reloads the page so the saved look takes effect. */
  readonly pageReload: () => void;
}

/**
 * Turns a stored look value into a menu choice; nothing saved or an unknown
 * value follows the system.
 *
 * @param storedValue Saved look value, or null.
 * @returns Menu choice.
 */
export function themeLookMenuChoiceFromStored(storedValue: string | null): ThemeLookMenuChoice {
  return themeLookIsKnown(storedValue) ? storedValue : THEME_LOOK_STORED_SYSTEM;
}

/**
 * Returns the hooks that save into browser storage and reload the page.
 *
 * @returns Live hooks.
 */
export function themeLookMenuHooksLiveCreate(): ThemeLookMenuHooks {
  return {
    savedChoice: themeLookMenuChoiceFromStored(themeLookStoredValueRead()),
    lookSave: themeLookSave,
    pageReload: () => location.reload(),
  };
}

/**
 * Builds one row of the Look submenu.
 *
 * @param choice Look choice the row picks.
 * @param hooks Save and reload callbacks.
 * @returns Menu row checked while the choice is saved.
 */
function themeLookMenuRowBuild(choice: ThemeLookMenuChoice, hooks: ThemeLookMenuHooks): ToolbarMenuEntry {
  return {
    label: THEME_LOOK_MENU_LABELS[choice],
    isChecked: () => hooks.savedChoice === choice,
    onClick: () => {
      if (choice === hooks.savedChoice) {
        return;
      }
      hooks.lookSave(choice);
      hooks.pageReload();
    },
  };
}

/**
 * Builds the Look submenu that switches the chrome look and reloads the page.
 *
 * @param hooks Save and reload callbacks.
 * @returns Submenu entry.
 */
export function themeLookMenuBuild(hooks: ThemeLookMenuHooks = themeLookMenuHooksLiveCreate()): ToolbarMenuSubmenu {
  return {
    kind: 'submenu',
    label: 'Look',
    children: THEME_LOOK_MENU_CHOICES.map((choice) => themeLookMenuRowBuild(choice, hooks)),
  };
}
