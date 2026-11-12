import { describe, expect, it, vi } from 'vitest';
import { isMenuAction } from '@/ui/menu/menu_types.js';
import {
  THEME_LOOK_MENU_CHOICES,
  THEME_LOOK_MENU_LABELS,
  themeLookMenuBuild,
  themeLookMenuChoiceFromStored,
  type ThemeLookMenuChoice,
} from '@/theme/menu/theme_look_menu.js';

/**
 * Creates spy hooks with a saved choice.
 *
 * @param savedChoice Choice the user saved.
 * @returns Hooks with spies.
 */
function themeLookMenuTestHooks(savedChoice: ThemeLookMenuChoice) {
  return { savedChoice, lookSave: vi.fn(), pageReload: vi.fn() };
}

describe('themeLookMenuBuild', () => {
  it('lists every choice once and checks only the saved choice', () => {
    const rows = themeLookMenuBuild(themeLookMenuTestHooks('mac_glass_dark')).children.filter(isMenuAction);
    expect(rows.map((row) => row.label)).toEqual(
      THEME_LOOK_MENU_CHOICES.map((choice) => THEME_LOOK_MENU_LABELS[choice]),
    );
    expect(rows.filter((row) => row.isChecked?.()).map((row) => row.label)).toEqual([
      THEME_LOOK_MENU_LABELS.mac_glass_dark,
    ]);
  });

  it('saves another choice and reloads, but does nothing for the saved choice', () => {
    const hooks = themeLookMenuTestHooks('system');
    const rows = themeLookMenuBuild(hooks).children.filter(isMenuAction);
    rows.find((row) => row.label === THEME_LOOK_MENU_LABELS.system)?.onClick();
    expect(hooks.lookSave).not.toHaveBeenCalled();
    rows.find((row) => row.label === THEME_LOOK_MENU_LABELS.classic)?.onClick();
    expect(hooks.lookSave).toHaveBeenCalledWith('classic');
    expect(hooks.pageReload).toHaveBeenCalledTimes(1);
  });

  it('treats nothing saved or an unknown saved value as following the system', () => {
    expect(themeLookMenuChoiceFromStored(null)).toBe('system');
    expect(themeLookMenuChoiceFromStored('neon')).toBe('system');
    expect(themeLookMenuChoiceFromStored('classic')).toBe('classic');
  });
});
