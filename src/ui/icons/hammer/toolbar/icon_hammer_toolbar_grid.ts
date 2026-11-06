import { IconHammerCube } from '../core/icon_hammer_cube.js';
import { IconHammerCubeGeometry } from '../core/icon_hammer_cube_geometry.js';
import { IconHammerGradient } from '../core/icon_hammer_gradient.js';
import { IconHammerGridPlate } from '../core/icon_hammer_grid_plate.js';
import { IconHammerGroup, type IconHammerDrawer } from '../core/icon_hammer_group.js';
import type { IconHammerIdScope } from '../core/icon_hammer_id_scope.js';
import { ICON_HAMMER_HIGHLIGHT, ICON_HAMMER_RAMPS, type IconHammerRamp } from '../core/icon_hammer_palette.js';
import { IconHammerShape } from '../core/icon_hammer_shape.js';

/** Names of the grid toolbar icons. */
export type IconHammerToolbarGridName =
  'grid_show' | 'grid_smaller' | 'grid_larger' | 'grid_snap' | 'grid_3d' | 'grid_projected';

/** Corners of the receding floor of the 3D grid icon, front left first. */
const ICON_HAMMER_GRID_FLOOR_CORNERS = [2.5, 27.5, 21.5, 27.5, 29.5, 13.5, 10.5, 13.5];

/** Toolbar icons that show, resize, snap to and project the grid. */
export class IconHammerToolbarGrid extends IconHammerGroup<IconHammerToolbarGridName> {
  /**
   * Returns the drawer of every icon in the group.
   *
   * @returns Drawers keyed by icon name.
   */
  drawersRead(): Readonly<Record<IconHammerToolbarGridName, IconHammerDrawer>> {
    return {
      grid_show: () => this.plate(6),
      grid_smaller: (scope) => this.plate(4) + this.badge(scope, ICON_HAMMER_RAMPS.red, 'M20.5 23.5h6'),
      grid_larger: (scope) => this.plate(9) + this.badge(scope, ICON_HAMMER_RAMPS.green, 'M20.5 23.5h6M23.5 20.5v6'),
      grid_snap: () => this.plate(6) + this.magnet(),
      grid_3d: (scope) => this.floor(scope),
      grid_projected: (scope) => this.projected(scope),
    };
  }

  /**
   * Draws the white plate ruled in blue at a grid spacing.
   *
   * @param cellPx Grid spacing in pixels.
   * @returns Plate markup.
   */
  private plate(cellPx: number): string {
    return IconHammerGridPlate.draw(2, 2, 28, cellPx, ICON_HAMMER_RAMPS.blue.base, ICON_HAMMER_HIGHLIGHT);
  }

  /**
   * Draws a round badge in the bottom right corner holding a white sign.
   *
   * @param scope Id scope of the icon being rendered.
   * @param ramp Badge colour family.
   * @param signPathData Path data of the white sign.
   * @returns Badge markup.
   */
  private badge(scope: IconHammerIdScope, ramp: IconHammerRamp, signPathData: string): string {
    const fill = IconHammerGradient.rampLit(scope, 'badge', ramp);
    const disc = IconHammerShape.circle(23.5, 23.5, 7, fill.paint);
    return fill.defs + disc + IconHammerShape.stroke(signPathData, ICON_HAMMER_HIGHLIGHT, 2, 'butt');
  }

  /**
   * Draws the red horseshoe magnet with steel poles.
   *
   * @returns Magnet markup.
   */
  private magnet(): string {
    const horseshoe = IconHammerShape.band('M11 12V18A5 5 0 0 0 21 18V12', ICON_HAMMER_RAMPS.red.base, 5, 'butt');
    const poles =
      IconHammerShape.rect(8, 7, 6, 5, ICON_HAMMER_RAMPS.steel.light) +
      IconHammerShape.rect(18, 7, 6, 5, ICON_HAMMER_RAMPS.steel.light);
    return horseshoe + poles;
  }

  /**
   * Draws a blue floor receding into the distance, ruled into cells.
   *
   * @param scope Id scope of the icon being rendered.
   * @returns Icon markup.
   */
  private floor(scope: IconHammerIdScope): string {
    const fill = IconHammerGradient.rampLit(scope, 'floor', ICON_HAMMER_RAMPS.blue, 'vertical');
    const floor = IconHammerShape.polygon(ICON_HAMMER_GRID_FLOOR_CORNERS, fill.paint);
    const lines = IconHammerShape.stroke(this.floorLinesPathData(3), ICON_HAMMER_RAMPS.blue.dark, 1, 'butt');
    return fill.defs + floor + lines;
  }

  /**
   * Returns the lines splitting the floor into equal cells.
   *
   * @param divisions Number of cells along each floor edge.
   * @returns Path data of the floor lines.
   */
  private floorLinesPathData(divisions: number): string {
    const [ax = 0, ay = 0, bx = 0, by = 0, cx = 0, cy = 0, dx = 0, dy = 0] = ICON_HAMMER_GRID_FLOOR_CORNERS;
    let pathData = '';
    for (let step = 1; step < divisions; step += 1) {
      const t = step / divisions;
      pathData += `M${ax + (bx - ax) * t} ${ay + (by - ay) * t}L${dx + (cx - dx) * t} ${dy + (cy - dy) * t}`;
      pathData += `M${ax + (dx - ax) * t} ${ay + (dy - ay) * t}L${bx + (cx - bx) * t} ${by + (cy - by) * t}`;
    }
    return pathData;
  }

  /**
   * Draws a white cube with a blue grid projected onto every face.
   *
   * @param scope Id scope of the icon being rendered.
   * @returns Icon markup.
   */
  private projected(scope: IconHammerIdScope): string {
    const layout = { left: 3, top: 3, size: 18, depth: 8 };
    const cube = IconHammerCube.shaded(scope, 'cube', layout, ICON_HAMMER_RAMPS.white);
    const lattice = new IconHammerCubeGeometry(layout).faceDividersPathData(3);
    return cube + IconHammerShape.stroke(lattice, ICON_HAMMER_RAMPS.blue.base, 1, 'butt');
  }
}
