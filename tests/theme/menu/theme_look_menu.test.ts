import { describe, expect, it, vi } from 'vitest';
import { isMenuAction } from '@/ui/menu/menu_types.js';
import { THEME_LOOKS } from '@/theme/theme_look.js';
import { THEME_LOOK_MENU_LABELS, themeLookMenuBuild } from '@/theme/menu/theme_look_menu.js';

describe('themeLookMenuBuild', () => {
  it('lists every look once and checks only the look in use', () => {
    const hooks = { currentLook: 'mac_glass' as const, lookSave: vi.fn(), pageReload: vi.fn() };
    const rows = themeLookMenuBuild(hooks).children.filter(isMenuAction);
    expect(rows.map((row) => row.label)).toEqual(THEME_LOOKS.map((look) => THEME_LOOK_MENU_LABELS[look]));
    expect(rows.filter((row) => row.isChecked?.()).map((row) => row.label)).toEqual([THEME_LOOK_MENU_LABELS.mac_glass]);
  });

  it('saves another look and reloads, but does nothing for the look in use', () => {
    const hooks = { currentLook: 'mac_glass' as const, lookSave: vi.fn(), pageReload: vi.fn() };
    const rows = themeLookMenuBuild(hooks).children.filter(isMenuAction);
    rows.find((row) => row.label === THEME_LOOK_MENU_LABELS.mac_glass)?.onClick();
    expect(hooks.lookSave).not.toHaveBeenCalled();
    rows.find((row) => row.label === THEME_LOOK_MENU_LABELS.classic)?.onClick();
    expect(hooks.lookSave).toHaveBeenCalledWith('classic');
    expect(hooks.pageReload).toHaveBeenCalledTimes(1);
  });
});
