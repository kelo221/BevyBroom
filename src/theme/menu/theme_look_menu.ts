import type { ToolbarMenuEntry, ToolbarMenuSubmenu } from '@/ui/menu/menu_types.js';
import { THEME_LOOKS, type ThemeLook } from '@/theme/theme_look.js';
import { THEME_LOOK_CURRENT, themeLookSave } from '@/theme/theme_look_current.js';

/** Menu labels of the chrome looks. */
export const THEME_LOOK_MENU_LABELS: Readonly<Record<ThemeLook, string>> = Object.freeze({
  classic: 'Classic (Hammer)',
  mac_glass: 'macOS Glass',
});

/** Callbacks the Look submenu runs, replaceable in tests. */
export interface ThemeLookMenuHooks {
  /** Look this page started with. */
  readonly currentLook: ThemeLook;
  /** Saves the chosen look. */
  readonly lookSave: (look: ThemeLook) => void;
  /** Reloads the page so the saved look takes effect. */
  readonly pageReload: () => void;
}

/**
 * Returns the hooks that save into browser storage and reload the page.
 *
 * @returns Live hooks.
 */
export function themeLookMenuHooksLiveCreate(): ThemeLookMenuHooks {
  return { currentLook: THEME_LOOK_CURRENT, lookSave: themeLookSave, pageReload: () => location.reload() };
}

/**
 * Builds one row of the Look submenu.
 *
 * @param look Look the row picks.
 * @param hooks Save and reload callbacks.
 * @returns Menu row checked while the look is in use.
 */
function themeLookMenuRowBuild(look: ThemeLook, hooks: ThemeLookMenuHooks): ToolbarMenuEntry {
  return {
    label: THEME_LOOK_MENU_LABELS[look],
    isChecked: () => hooks.currentLook === look,
    onClick: () => {
      if (look === hooks.currentLook) {
        return;
      }
      hooks.lookSave(look);
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
  return { kind: 'submenu', label: 'Look', children: THEME_LOOKS.map((look) => themeLookMenuRowBuild(look, hooks)) };
}
