import { IconHammerCube } from '../core/icon_hammer_cube.js';
import { IconHammerCubeGeometry } from '../core/icon_hammer_cube_geometry.js';
import { IconHammerGradient } from '../core/icon_hammer_gradient.js';
import { IconHammerGroup, type IconHammerDrawer } from '../core/icon_hammer_group.js';
import type { IconHammerIdScope } from '../core/icon_hammer_id_scope.js';
import { ICON_HAMMER_OUTLINE, ICON_HAMMER_RAMPS } from '../core/icon_hammer_palette.js';
import { IconHammerShape } from '../core/icon_hammer_shape.js';

/** Names of the brush operation toolbar icons. */
export type IconHammerToolbarCsgName =
  'csg_carve' | 'csg_hollow' | 'csg_group' | 'csg_ungroup' | 'csg_flip_horizontal' | 'csg_flip_vertical';

/** Toolbar icons that carve, hollow, group and mirror brushes. */
export class IconHammerToolbarCsg extends IconHammerGroup<IconHammerToolbarCsgName> {
  /**
   * Returns the drawer of every icon in the group.
   *
   * @returns Drawers keyed by icon name.
   */
  drawersRead(): Readonly<Record<IconHammerToolbarCsgName, IconHammerDrawer>> {
    return {
      csg_carve: (scope) => this.carve(scope),
      csg_hollow: (scope) => this.hollow(scope),
      csg_group: (scope) => this.groupFrame() + this.groupCubes(scope, 0),
      csg_ungroup: (scope) => this.brokenFrame() + this.groupCubes(scope, 2),
      csg_flip_horizontal: (scope) => this.flip(scope),
      csg_flip_vertical: (scope) => IconHammerShape.group(this.flip(scope), 'rotate(90 16 16)'),
    };
  }

  /**
   * Draws a steel block with a red block pushed into its corner, the carved
   * part showing as a dark notch.
   *
   * @param scope Id scope of the icon being rendered.
   * @returns Icon markup.
   */
  private carve(scope: IconHammerIdScope): string {
    const block = IconHammerCube.shaded(
      scope,
      'block',
      { left: 2, top: 6, size: 17, depth: 7 },
      ICON_HAMMER_RAMPS.steel,
    );
    const notch = IconHammerShape.polygon(
      [14.5, 13.5, 19.5, 13.5, 19.5, 21.5, 14.5, 21.5],
      ICON_HAMMER_RAMPS.coal.base,
    );
    const carver = IconHammerCube.shaded(
      scope,
      'carver',
      { left: 14, top: 1, size: 11, depth: 5 },
      ICON_HAMMER_RAMPS.red,
    );
    return block + notch + carver;
  }

  /**
   * Draws a steel block opened up to show its hollow inside.
   *
   * @param scope Id scope of the icon being rendered.
   * @returns Icon markup.
   */
  private hollow(scope: IconHammerIdScope): string {
    const layout = { left: 3, top: 3, size: 18, depth: 8 };
    const block = IconHammerCube.shaded(scope, 'block', layout, ICON_HAMMER_RAMPS.steel);
    const box = new IconHammerCubeGeometry(layout).frontBox();
    const cavity = IconHammerGradient.linear(
      scope,
      'cavity',
      ICON_HAMMER_RAMPS.coal.dark,
      ICON_HAMMER_RAMPS.coal.light,
    );
    const hole = IconHammerShape.rect(box.left + 4, box.top + 4, box.size - 8, box.size - 8, cavity.paint);
    return block + cavity.defs + hole;
  }

  /**
   * Draws the rounded yellow tray that holds grouped cubes.
   *
   * @returns Frame markup.
   */
  private groupFrame(): string {
    return IconHammerShape.rect(1, 1, 30, 30, ICON_HAMMER_RAMPS.yellow.light, ICON_HAMMER_OUTLINE, 4);
  }

  /**
   * Draws a red, a green and a blue cube, pushed apart from the centre by a
   * spread distance.
   *
   * @param scope Id scope of the icon being rendered.
   * @param spreadPx Distance each cube moves away from the centre.
   * @returns Markup of the three cubes.
   */
  private groupCubes(scope: IconHammerIdScope, spreadPx: number): string {
    const ramps = ICON_HAMMER_RAMPS;
    return (
      IconHammerCube.shaded(scope, 'red', { left: 4 - spreadPx, top: 4 - spreadPx, size: 9, depth: 4 }, ramps.red) +
      IconHammerCube.shaded(
        scope,
        'green',
        { left: 16 + spreadPx, top: 4 - spreadPx, size: 9, depth: 4 },
        ramps.green,
      ) +
      IconHammerCube.shaded(scope, 'blue', { left: 10, top: 15 + spreadPx, size: 9, depth: 4 }, ramps.blue)
    );
  }

  /**
   * Draws the dashed outline left behind by a dissolved group tray.
   *
   * @returns Frame markup.
   */
  private brokenFrame(): string {
    return IconHammerShape.strokeDashed('M1.5 1.5H30.5V30.5H1.5Z', ICON_HAMMER_OUTLINE, '4 3');
  }

  /**
   * Draws a blue triangle and its white mirror image across a dashed axis.
   *
   * @param scope Id scope of the icon being rendered.
   * @returns Icon markup.
   */
  private flip(scope: IconHammerIdScope): string {
    const fill = IconHammerGradient.rampLit(scope, 'shape', ICON_HAMMER_RAMPS.blue);
    const axis = IconHammerShape.strokeDashed('M15.5 1V31', ICON_HAMMER_OUTLINE, '2 2');
    const original = IconHammerShape.polygon([12.5, 5.5, 12.5, 26.5, 2.5, 26.5], fill.paint);
    const mirrored = IconHammerShape.polygon([18.5, 5.5, 18.5, 26.5, 28.5, 26.5], ICON_HAMMER_RAMPS.white.light);
    return fill.defs + axis + original + mirrored;
  }
}
