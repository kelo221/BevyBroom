import { IconHammerArrow } from '../core/icon_hammer_arrow.js';
import { IconHammerCube } from '../core/icon_hammer_cube.js';
import { IconHammerGradient } from '../core/icon_hammer_gradient.js';
import { IconHammerGroup, type IconHammerDrawer } from '../core/icon_hammer_group.js';
import type { IconHammerIdScope } from '../core/icon_hammer_id_scope.js';
import {
  ICON_HAMMER_HIGHLIGHT,
  ICON_HAMMER_OUTLINE,
  ICON_HAMMER_OUTLINE_SOFT,
  ICON_HAMMER_RAMPS,
} from '../core/icon_hammer_palette.js';
import { IconHammerShape } from '../core/icon_hammer_shape.js';

/** Names of the transform mode and gizmo axes toolbar icons. */
export type IconHammerToolbarTransformName =
  | 'transform_bounds'
  | 'transform_move'
  | 'transform_rotate'
  | 'transform_scale'
  | 'transform_shear'
  | 'transform_space_global'
  | 'transform_space_local';

/** Toolbar icons for the transform gizmo modes and their axes space. */
export class IconHammerToolbarTransform extends IconHammerGroup<IconHammerToolbarTransformName> {
  /**
   * Returns the drawer of every icon in the group.
   *
   * @returns Drawers keyed by icon name.
   */
  drawersRead(): Readonly<Record<IconHammerToolbarTransformName, IconHammerDrawer>> {
    return {
      transform_bounds: () => this.bounds(),
      transform_move: () => this.move(),
      transform_rotate: () => this.rotate(),
      transform_scale: (scope) => this.scale(scope),
      transform_shear: (scope) => this.shear(scope),
      transform_space_global: (scope) => this.globe(scope),
      transform_space_local: (scope) => this.localAxes(scope),
    };
  }

  /**
   * Draws a dashed box with white handles on its corners and edge middles.
   *
   * @returns Icon markup.
   */
  private bounds(): string {
    const box = IconHammerShape.strokeDashed('M5.5 5.5H26.5V26.5H5.5Z', ICON_HAMMER_OUTLINE, '2 2');
    const handles = [5.5, 5.5, 16.5, 5.5, 26.5, 5.5, 26.5, 16.5, 26.5, 26.5, 16.5, 26.5, 5.5, 26.5, 5.5, 16.5];
    return box + IconHammerShape.handlesAt(handles, ICON_HAMMER_HIGHLIGHT);
  }

  /**
   * Draws red horizontal and green vertical double arrows crossing.
   *
   * @returns Icon markup.
   */
  private move(): string {
    const horizontal = IconHammerArrow.double({ x: 2, y: 16 }, { x: 30, y: 16 }, ICON_HAMMER_RAMPS.red.base, 2);
    const vertical = IconHammerArrow.double({ x: 16, y: 2 }, { x: 16, y: 30 }, ICON_HAMMER_RAMPS.green.base, 2);
    return horizontal + vertical + IconHammerShape.handle(16.5, 16.5, ICON_HAMMER_HIGHLIGHT);
  }

  /**
   * Draws a green arrow running almost all the way around a circle.
   *
   * @returns Icon markup.
   */
  private rotate(): string {
    const shaft = 'M25 16A9 9 0 1 1 20.5 8.2';
    const direction = { x: 0.866, y: 0.5 };
    return IconHammerArrow.curved(shaft, { x: 20.5, y: 8.2 }, direction, ICON_HAMMER_RAMPS.green.base, 3);
  }

  /**
   * Draws a small blue box growing along an orange arrow into a dashed larger
   * box.
   *
   * @param scope Id scope of the icon being rendered.
   * @returns Icon markup.
   */
  private scale(scope: IconHammerIdScope): string {
    const fill = IconHammerGradient.rampLit(scope, 'box', ICON_HAMMER_RAMPS.blue);
    const target = IconHammerShape.strokeDashed('M2.5 29.5V2.5H29.5V29.5Z', ICON_HAMMER_OUTLINE_SOFT, '2 2');
    const small = IconHammerShape.rect(2, 18, 12, 12, fill.paint);
    const grow = IconHammerArrow.straight({ x: 12, y: 20 }, { x: 28, y: 4 }, ICON_HAMMER_RAMPS.orange.base, 2);
    return fill.defs + target + small + grow;
  }

  /**
   * Draws a blue parallelogram slid sideways from a dashed box, with a red
   * arrow along its top.
   *
   * @param scope Id scope of the icon being rendered.
   * @returns Icon markup.
   */
  private shear(scope: IconHammerIdScope): string {
    const fill = IconHammerGradient.rampLit(scope, 'shape', ICON_HAMMER_RAMPS.blue);
    const original = IconHammerShape.strokeDashed('M3.5 11.5H21.5V28.5H3.5Z', ICON_HAMMER_OUTLINE_SOFT, '2 2');
    const sheared = IconHammerShape.polygon([3.5, 28.5, 10.5, 11.5, 28.5, 11.5, 21.5, 28.5], fill.paint);
    const slide = IconHammerArrow.straight({ x: 9, y: 5 }, { x: 29, y: 5 }, ICON_HAMMER_RAMPS.red.base, 2);
    return fill.defs + original + sheared + slide;
  }

  /**
   * Draws a blue globe with green land and white meridians.
   *
   * @param scope Id scope of the icon being rendered.
   * @returns Icon markup.
   */
  private globe(scope: IconHammerIdScope): string {
    const ocean = IconHammerGradient.rampLit(scope, 'ocean', ICON_HAMMER_RAMPS.blue);
    const sphere = IconHammerShape.circle(16, 16, 13, ocean.paint);
    const meridians = 'M16 3V29M3 16H29M16 3C9 8 9 24 16 29C23 24 23 8 16 3';
    const lines = IconHammerShape.stroke(meridians, ICON_HAMMER_HIGHLIGHT, 1, 'butt');
    const rim = IconHammerShape.circle(16, 16, 13, 'none');
    return ocean.defs + sphere + this.globeLand() + `<g opacity="0.6">${lines}</g>` + rim;
  }

  /**
   * Draws the two green land masses of the globe without outlines.
   *
   * @returns Land markup.
   */
  private globeLand(): string {
    const green = ICON_HAMMER_RAMPS.green.base;
    const west = IconHammerShape.polygon([7, 9, 13, 6, 16, 11, 12, 14, 14, 20, 9, 19, 5, 14], green, 'none');
    const east = IconHammerShape.polygon([19, 15, 25, 13, 27, 19, 22, 25, 19, 21], green, 'none');
    return west + east;
  }

  /**
   * Draws a small steel cube with red, green and blue local axis arrows.
   *
   * @param scope Id scope of the icon being rendered.
   * @returns Icon markup.
   */
  private localAxes(scope: IconHammerIdScope): string {
    const origin = { x: 12, y: 20 };
    const cube = IconHammerCube.shaded(
      scope,
      'cube',
      { left: 7, top: 10, size: 10, depth: 5 },
      ICON_HAMMER_RAMPS.steel,
    );
    const axisX = IconHammerArrow.straight(origin, { x: 30, y: 20 }, ICON_HAMMER_RAMPS.red.base, 2);
    const axisY = IconHammerArrow.straight(origin, { x: 12, y: 2 }, ICON_HAMMER_RAMPS.green.base, 2);
    const axisZ = IconHammerArrow.straight(origin, { x: 2, y: 30 }, ICON_HAMMER_RAMPS.blue.base, 2);
    return cube + axisX + axisY + axisZ;
  }
}
