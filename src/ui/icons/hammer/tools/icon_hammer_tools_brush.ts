import { IconHammerArrow } from '../core/icon_hammer_arrow.js';
import { IconHammerCube } from '../core/icon_hammer_cube.js';
import { IconHammerGradient } from '../core/icon_hammer_gradient.js';
import { IconHammerGridPlate } from '../core/icon_hammer_grid_plate.js';
import { IconHammerGroup, type IconHammerDrawer } from '../core/icon_hammer_group.js';
import type { IconHammerIdScope } from '../core/icon_hammer_id_scope.js';
import { ICON_HAMMER_HIGHLIGHT, ICON_HAMMER_OUTLINE, ICON_HAMMER_RAMPS } from '../core/icon_hammer_palette.js';
import { IconHammerShape } from '../core/icon_hammer_shape.js';

/** Names of the palette tools that create, cut and bound brushes. */
export type IconHammerToolsBrushName =
  'tool_block' | 'tool_clip' | 'tool_polygon' | 'tool_sprinkle' | 'tool_cordon' | 'tool_grid';

/** Left palette tools that build, clip, scatter and bound brushes. */
export class IconHammerToolsBrush extends IconHammerGroup<IconHammerToolsBrushName> {
  /**
   * Returns the drawer of every icon in the group.
   *
   * @returns Drawers keyed by icon name.
   */
  drawersRead(): Readonly<Record<IconHammerToolsBrushName, IconHammerDrawer>> {
    return {
      tool_block: (scope) =>
        IconHammerCube.shaded(scope, 'block', { left: 3, top: 3, size: 19, depth: 8 }, ICON_HAMMER_RAMPS.brick),
      tool_clip: (scope) => this.clip(scope),
      tool_polygon: (scope) => this.polygon(scope),
      tool_sprinkle: (scope) => this.sprinkle(scope),
      tool_cordon: (scope) => this.cordon(scope),
      tool_grid: () => this.grid(),
    };
  }

  /**
   * Draws a cube cut along a dashed line into a kept green part and a removed
   * red part.
   *
   * @param scope Id scope of the icon being rendered.
   * @returns Icon markup.
   */
  private clip(scope: IconHammerIdScope): string {
    const layout = { left: 3, top: 4, size: 18, depth: 8 };
    const kept = IconHammerCube.shaded(scope, 'kept', layout, ICON_HAMMER_RAMPS.green);
    const region = IconHammerShape.clipPathPolygon(scope.idFor('cut-region'), [0, 0, 32, 0, 32, 6, 0, 24]);
    const removed = IconHammerCube.shaded(scope, 'removed', layout, ICON_HAMMER_RAMPS.red);
    const cutPath = 'M1 23.5L31 6.5';
    const cut =
      IconHammerShape.stroke(cutPath, ICON_HAMMER_HIGHLIGHT, 3) +
      IconHammerShape.strokeDashed(cutPath, ICON_HAMMER_OUTLINE, '3 2');
    return kept + region + IconHammerShape.clipped(removed, scope.urlFor('cut-region')) + cut;
  }

  /**
   * Draws a green polygon outline with a red handle on every corner.
   *
   * @param scope Id scope of the icon being rendered.
   * @returns Icon markup.
   */
  private polygon(scope: IconHammerIdScope): string {
    const fill = IconHammerGradient.rampLit(scope, 'face', ICON_HAMMER_RAMPS.green);
    const corners = [6.5, 6.5, 24.5, 3.5, 28.5, 20.5, 15.5, 28.5, 3.5, 18.5];
    const handles = IconHammerShape.handlesAt(corners, ICON_HAMMER_RAMPS.red.base);
    return fill.defs + IconHammerShape.polygon(corners, fill.paint) + handles;
  }

  /**
   * Draws three small scattered cubes and a yellow sparkle.
   *
   * @param scope Id scope of the icon being rendered.
   * @returns Icon markup.
   */
  private sprinkle(scope: IconHammerIdScope): string {
    const sparkle = [8.5, 1.5, 10, 6, 14.5, 7.5, 10, 9, 8.5, 13.5, 7, 9, 2.5, 7.5, 7, 6];
    return (
      IconHammerShape.polygon(sparkle, ICON_HAMMER_RAMPS.yellow.base) +
      IconHammerCube.shaded(scope, 'blue', { left: 16, top: 3, size: 10, depth: 4 }, ICON_HAMMER_RAMPS.blue) +
      IconHammerCube.shaded(scope, 'green', { left: 2, top: 16, size: 10, depth: 4 }, ICON_HAMMER_RAMPS.green) +
      IconHammerCube.shaded(scope, 'orange', { left: 17, top: 17, size: 10, depth: 4 }, ICON_HAMMER_RAMPS.orange)
    );
  }

  /**
   * Draws a steel cube inside a red and white dashed bounding frame.
   *
   * @param scope Id scope of the icon being rendered.
   * @returns Icon markup.
   */
  private cordon(scope: IconHammerIdScope): string {
    const framePath = 'M4 4H28V28H4Z';
    const frameOutline = IconHammerShape.rect(2, 2, 28, 28, 'none') + IconHammerShape.rect(5, 5, 22, 22, 'none');
    const frame =
      IconHammerShape.stroke(framePath, ICON_HAMMER_HIGHLIGHT, 2, 'butt') +
      IconHammerShape.strokeDashed(framePath, ICON_HAMMER_RAMPS.red.base, '3 2', 2);
    const inside = IconHammerCube.shaded(
      scope,
      'inside',
      { left: 9, top: 9, size: 10, depth: 4 },
      ICON_HAMMER_RAMPS.steel,
    );
    return frame + frameOutline + inside;
  }

  /**
   * Draws a blue ruled plate with red and green axis arrows from its corner.
   *
   * @returns Icon markup.
   */
  private grid(): string {
    const plate = IconHammerGridPlate.draw(3, 3, 26, 6, ICON_HAMMER_RAMPS.blue.light, ICON_HAMMER_HIGHLIGHT);
    const origin = { x: 7, y: 25 };
    const axisX = IconHammerArrow.straight(origin, { x: 29, y: 25 }, ICON_HAMMER_RAMPS.red.base);
    const axisY = IconHammerArrow.straight(origin, { x: 7, y: 3 }, ICON_HAMMER_RAMPS.green.base);
    return plate + axisX + axisY;
  }
}
