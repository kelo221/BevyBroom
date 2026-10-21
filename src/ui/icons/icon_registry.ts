import type { IconName } from '@/ui/icons/icon_name.js';
import { ICON_SET_MATERIAL_DESIGN_PATHS } from '@/ui/icons/icon_set_material_design.js';

/** Edge length of the square grid every icon path is drawn on. */
export const ICON_GRID_SIZE = 24;

/** Looks up the drawing data of editor icons by name. */
export class IconRegistry {
  /**
   * Returns the SVG path data of an icon on the {@link ICON_GRID_SIZE} grid.
   *
   * @param iconName Icon name.
   * @returns Path data for the `d` attribute.
   */
  static pathOf(iconName: IconName): string {
    return ICON_SET_MATERIAL_DESIGN_PATHS[iconName];
  }
}
