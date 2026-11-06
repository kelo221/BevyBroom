import { IconHammerCube } from '../core/icon_hammer_cube.js';
import { IconHammerCubeGeometry } from '../core/icon_hammer_cube_geometry.js';
import { IconHammerGradient } from '../core/icon_hammer_gradient.js';
import { IconHammerGroup, type IconHammerDrawer } from '../core/icon_hammer_group.js';
import type { IconHammerIdScope } from '../core/icon_hammer_id_scope.js';
import { ICON_HAMMER_OUTLINE, ICON_HAMMER_RAMPS } from '../core/icon_hammer_palette.js';
import { IconHammerShape } from '../core/icon_hammer_shape.js';
import { IconHammerTextureTile } from '../core/icon_hammer_texture_tile.js';

/** Names of the palette tools that put textures, decals and overlays on faces. */
export type IconHammerToolsTextureName =
  'tool_texture_application' | 'tool_texture_apply' | 'tool_decal' | 'tool_overlay';

/** Left palette tools that texture faces and stick decals and overlays. */
export class IconHammerToolsTexture extends IconHammerGroup<IconHammerToolsTextureName> {
  /**
   * Returns the drawer of every icon in the group.
   *
   * @returns Drawers keyed by icon name.
   */
  drawersRead(): Readonly<Record<IconHammerToolsTextureName, IconHammerDrawer>> {
    return {
      tool_texture_application: (scope) => this.textureApplication(scope),
      tool_texture_apply: (scope) => this.textureApply(scope),
      tool_decal: (scope) => this.decal(scope),
      tool_overlay: (scope) => this.overlay(scope),
    };
  }

  /**
   * Draws a cube whose faces carry differently coloured tiled textures.
   *
   * @param scope Id scope of the icon being rendered.
   * @returns Icon markup.
   */
  private textureApplication(scope: IconHammerIdScope): string {
    const geometry = new IconHammerCubeGeometry({ left: 3, top: 3, size: 18, depth: 8 });
    const front = IconHammerGradient.rampLit(scope, 'front', ICON_HAMMER_RAMPS.yellow);
    const top = IconHammerGradient.rampLit(scope, 'top', ICON_HAMMER_RAMPS.blue, 'horizontal');
    const side = IconHammerGradient.rampShaded(scope, 'side', ICON_HAMMER_RAMPS.red, 'vertical');
    const faces = IconHammerCube.faces(geometry, { top: top.paint, front: front.paint, side: side.paint });
    const box = geometry.frontBox();
    const darkCells = IconHammerTextureTile.checkerCells(box.left, box.top, box.size, (box.size - 1) / 2);
    const dividers = IconHammerShape.stroke(geometry.faceDividersPathData(2), ICON_HAMMER_OUTLINE, 1, 'butt');
    return front.defs + top.defs + side.defs + faces + darkCells + dividers;
  }

  /**
   * Draws a checkered texture swatch with a paint brush laying it down.
   *
   * @param scope Id scope of the icon being rendered.
   * @returns Icon markup.
   */
  private textureApply(scope: IconHammerIdScope): string {
    const swatch = IconHammerTextureTile.draw(scope, 2, 14, 16);
    const handle = IconHammerShape.band('M29 3L20.5 11.5', ICON_HAMMER_RAMPS.wood.base, 3);
    const ferrule = IconHammerShape.band('M21.5 10.5L17.5 14.5', ICON_HAMMER_RAMPS.steel.light, 4, 'butt');
    const bristles = IconHammerShape.polygon(
      [15.5, 13.5, 19.5, 17.5, 14.5, 22.5, 9.5, 24.5, 11.5, 18.5],
      ICON_HAMMER_RAMPS.red.base,
    );
    return swatch + handle + ferrule + bristles;
  }

  /**
   * Draws a white sheet with a folded corner and a red splat stuck on it.
   *
   * @param scope Id scope of the icon being rendered.
   * @returns Icon markup.
   */
  private decal(scope: IconHammerIdScope): string {
    const paper = IconHammerGradient.rampLit(scope, 'paper', ICON_HAMMER_RAMPS.white);
    const splat = IconHammerGradient.rampLit(scope, 'splat', ICON_HAMMER_RAMPS.red);
    const sheet = IconHammerShape.path('M5.5 2.5H20.5L26.5 8.5V29.5H5.5Z', paper.paint);
    const fold = IconHammerShape.polygon([20.5, 2.5, 20.5, 8.5, 26.5, 8.5], ICON_HAMMER_RAMPS.white.dark);
    const blot =
      IconHammerShape.circle(16, 18, 6.5, splat.paint) +
      IconHammerShape.circle(9.5, 24.5, 1.5, splat.paint) +
      IconHammerShape.circle(22.5, 12, 1.5, splat.paint) +
      IconHammerShape.circle(15, 17, 2.5, ICON_HAMMER_RAMPS.yellow.base, 'none');
    return paper.defs + splat.defs + sheet + fold + blot;
  }

  /**
   * Draws a textured quad lying on a surface with a yellow handle on every
   * corner.
   *
   * @param scope Id scope of the icon being rendered.
   * @returns Icon markup.
   */
  private overlay(scope: IconHammerIdScope): string {
    const fill = IconHammerGradient.rampLit(scope, 'quad', ICON_HAMMER_RAMPS.cyan);
    const corners = [3.5, 21.5, 13.5, 6.5, 28.5, 9.5, 22.5, 27.5];
    const ruling = IconHammerShape.stroke('M8.5 14L25.5 18.5M21 8L13 24.5', ICON_HAMMER_RAMPS.cyan.dark, 1, 'butt');
    const handles = IconHammerShape.handlesAt(corners, ICON_HAMMER_RAMPS.yellow.base);
    return fill.defs + IconHammerShape.polygon(corners, fill.paint) + ruling + handles;
  }
}
