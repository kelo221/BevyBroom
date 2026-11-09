import { Theme } from '@/theme.js';
import type { IconHammerDrawer } from './core/icon_hammer_group.js';
import { IconHammerIdScope } from './core/icon_hammer_id_scope.js';
import { iconHammerSvgWrap } from './core/icon_hammer_svg.js';
import { IconHammerToolsBrush, type IconHammerToolsBrushName } from './tools/icon_hammer_tools_brush.js';
import { IconHammerToolsSelect, type IconHammerToolsSelectName } from './tools/icon_hammer_tools_select.js';
import { IconHammerToolsTexture, type IconHammerToolsTextureName } from './tools/icon_hammer_tools_texture.js';
import { IconHammerToolbarCsg, type IconHammerToolbarCsgName } from './toolbar/icon_hammer_toolbar_csg.js';
import { IconHammerToolbarEdit, type IconHammerToolbarEditName } from './toolbar/icon_hammer_toolbar_edit.js';
import { IconHammerToolbarGrid, type IconHammerToolbarGridName } from './toolbar/icon_hammer_toolbar_grid.js';
import { IconHammerToolbarRun, type IconHammerToolbarRunName } from './toolbar/icon_hammer_toolbar_run.js';
import {
  IconHammerToolbarSelection,
  type IconHammerToolbarSelectionName,
} from './toolbar/icon_hammer_toolbar_selection.js';
import {
  IconHammerToolbarTransform,
  type IconHammerToolbarTransformName,
} from './toolbar/icon_hammer_toolbar_transform.js';

/** Name of one full-colour classic Hammer icon. */
export type IconHammerName =
  | IconHammerToolsSelectName
  | IconHammerToolsBrushName
  | IconHammerToolsTextureName
  | IconHammerToolbarEditName
  | IconHammerToolbarGridName
  | IconHammerToolbarSelectionName
  | IconHammerToolbarCsgName
  | IconHammerToolbarTransformName
  | IconHammerToolbarRunName;

/** Drawer of every classic Hammer icon, keyed by icon name. */
const ICON_HAMMER_DRAWERS: Readonly<Record<IconHammerName, IconHammerDrawer>> = {
  ...new IconHammerToolsSelect().drawersRead(),
  ...new IconHammerToolsBrush().drawersRead(),
  ...new IconHammerToolsTexture().drawersRead(),
  ...new IconHammerToolbarEdit().drawersRead(),
  ...new IconHammerToolbarGrid().drawersRead(),
  ...new IconHammerToolbarSelection().drawersRead(),
  ...new IconHammerToolbarCsg().drawersRead(),
  ...new IconHammerToolbarTransform().drawersRead(),
  ...new IconHammerToolbarRun().drawersRead(),
};

/** Renders the full-colour classic Hammer icons by name. */
export class IconHammerCatalog {
  /**
   * Renders an icon as SVG markup. Every call gets fresh element ids, so many
   * copies of one icon can share a page.
   *
   * @param iconName Icon name.
   * @param sizePx Rendered width and height in pixels.
   * @returns SVG element markup on a 32 by 32 view box.
   */
  static svg(iconName: IconHammerName, sizePx: number): string {
    const scope = new IconHammerIdScope(iconName);
    return iconHammerSvgWrap(iconName, ICON_HAMMER_DRAWERS[iconName](scope), sizePx);
  }

  /**
   * Renders an icon at the left tool palette icon size.
   *
   * @param iconName Icon name.
   * @returns SVG element markup.
   */
  static paletteSvg(iconName: IconHammerName): string {
    return IconHammerCatalog.svg(iconName, Theme.toolPaletteIconPx);
  }

  /**
   * Renders an icon at the toolbar icon size.
   *
   * @param iconName Icon name.
   * @returns SVG element markup.
   */
  static toolbarSvg(iconName: IconHammerName): string {
    return IconHammerCatalog.svg(iconName, Theme.toolbarIconPx);
  }

  /**
   * Lists every icon name in the catalog.
   *
   * @returns Icon names.
   */
  static namesRead(): IconHammerName[] {
    return Object.keys(ICON_HAMMER_DRAWERS) as IconHammerName[];
  }
}
