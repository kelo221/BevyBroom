import { IconHammerCube } from '../core/icon_hammer_cube.js';
import { IconHammerGradient } from '../core/icon_hammer_gradient.js';
import { IconHammerGroup, type IconHammerDrawer } from '../core/icon_hammer_group.js';
import type { IconHammerIdScope } from '../core/icon_hammer_id_scope.js';
import { ICON_HAMMER_RAMPS, type IconHammerRamp } from '../core/icon_hammer_palette.js';
import { IconHammerShape } from '../core/icon_hammer_shape.js';
import { IconHammerTextureTile } from '../core/icon_hammer_texture_tile.js';

/** Names of the toolbar icons that open the browser windows. */
export type IconHammerToolbarBrowserName = 'browser_texture' | 'browser_entity' | 'browser_level';

/**
 * Left and top pixel of each of the four entity tiles, with the colour of its
 * cube.
 */
const ICON_HAMMER_BROWSER_ENTITY_TILES: ReadonlyArray<readonly [number, number, keyof typeof ICON_HAMMER_RAMPS]> = [
  [2, 2, 'orange'],
  [17, 2, 'blue'],
  [2, 17, 'green'],
  [17, 17, 'red'],
];

/** Corners of the three panels of the folded level map on the 32 by 32 grid. */
const ICON_HAMMER_BROWSER_LEVEL_PANELS: readonly (readonly number[])[] = [
  [2.5, 6.5, 11.5, 3.5, 11.5, 25.5, 2.5, 28.5],
  [11.5, 3.5, 20.5, 6.5, 20.5, 28.5, 11.5, 25.5],
  [20.5, 6.5, 29.5, 3.5, 29.5, 25.5, 20.5, 28.5],
];

/** Toolbar icons that open the Browser on its Place, Textures and Levels tabs. */
export class IconHammerToolbarBrowser extends IconHammerGroup<IconHammerToolbarBrowserName> {
  /**
   * Returns the drawer of every icon in the group.
   *
   * @returns Drawers keyed by icon name.
   */
  drawersRead(): Readonly<Record<IconHammerToolbarBrowserName, IconHammerDrawer>> {
    return {
      browser_texture: (scope) => this.texture(scope),
      browser_entity: (scope) => this.entity(scope),
      browser_level: (scope) => this.level(scope),
    };
  }

  /**
   * Draws a checkered texture swatch behind a second swatch, like a stack of
   * textures.
   *
   * @param scope Id scope of the icon being rendered.
   * @returns Icon markup.
   */
  private texture(scope: IconHammerIdScope): string {
    const back = IconHammerShape.rect(8, 2, 22, 22, ICON_HAMMER_RAMPS.white.dark);
    return back + IconHammerTextureTile.draw(scope, 2, 8, 22);
  }

  /**
   * Draws a two by two grid of tiles, each holding a small coloured cube.
   *
   * @param scope Id scope of the icon being rendered.
   * @returns Icon markup.
   */
  private entity(scope: IconHammerIdScope): string {
    return ICON_HAMMER_BROWSER_ENTITY_TILES.map(([left, top, rampName]) =>
      this.entityTile(scope, left, top, ICON_HAMMER_RAMPS[rampName], rampName),
    ).join('');
  }

  /**
   * Draws one dark tile with a shaded cube on it.
   *
   * @param scope Id scope of the icon being rendered.
   * @param left Left pixel column of the tile.
   * @param top Top pixel row of the tile.
   * @param ramp Colour family of the cube.
   * @param localName Name prefix unique within the icon.
   * @returns Tile markup.
   */
  private entityTile(
    scope: IconHammerIdScope,
    left: number,
    top: number,
    ramp: IconHammerRamp,
    localName: string,
  ): string {
    const tile = IconHammerShape.rect(left, top, 13, 13, ICON_HAMMER_RAMPS.coal.light);
    const cubeLayout = { left: left + 3, top: top + 2, size: 6, depth: 3 };
    return tile + IconHammerCube.shaded(scope, localName, cubeLayout, ramp);
  }

  /**
   * Draws a folded map sheet with a red marker on its middle panel.
   *
   * @param scope Id scope of the icon being rendered.
   * @returns Icon markup.
   */
  private level(scope: IconHammerIdScope): string {
    const paper = IconHammerGradient.rampLit(scope, 'sheet', ICON_HAMMER_RAMPS.green);
    const panels = ICON_HAMMER_BROWSER_LEVEL_PANELS.map((corners, index) =>
      IconHammerShape.polygon(corners, index === 1 ? ICON_HAMMER_RAMPS.green.light : paper.paint),
    ).join('');
    const marker = IconHammerShape.circle(16, 13, 3, ICON_HAMMER_RAMPS.red.base);
    return paper.defs + panels + marker;
  }
}
