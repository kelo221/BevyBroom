import { IconHammerGradient } from '../core/icon_hammer_gradient.js';
import { IconHammerGroup, type IconHammerDrawer } from '../core/icon_hammer_group.js';
import type { IconHammerIdScope } from '../core/icon_hammer_id_scope.js';
import { ICON_HAMMER_HIGHLIGHT, ICON_HAMMER_OUTLINE, ICON_HAMMER_RAMPS } from '../core/icon_hammer_palette.js';
import { IconHammerShape } from '../core/icon_hammer_shape.js';

/** Names of the build, run and game link toolbar icons. */
export type IconHammerToolbarRunName = 'run_map' | 'run_preview' | 'run_mcp';

/** Corners of the green play triangle on the 32 by 32 grid. */
const ICON_HAMMER_RUN_PLAY_TRIANGLE = [7.5, 3.5, 27.5, 16, 7.5, 28.5];

/** Toolbar icons that run the map, open the game preview and link tools. */
export class IconHammerToolbarRun extends IconHammerGroup<IconHammerToolbarRunName> {
  /**
   * Returns the drawer of every icon in the group.
   *
   * @returns Drawers keyed by icon name.
   */
  drawersRead(): Readonly<Record<IconHammerToolbarRunName, IconHammerDrawer>> {
    return {
      run_map: (scope) => this.play(scope),
      run_preview: (scope) => this.preview(scope),
      run_mcp: (scope) => this.mcp(scope),
    };
  }

  /**
   * Draws the green play triangle with a lit edge.
   *
   * @param scope Id scope of the icon being rendered.
   * @returns Icon markup.
   */
  private play(scope: IconHammerIdScope): string {
    const fill = IconHammerGradient.rampLit(scope, 'play', ICON_HAMMER_RAMPS.green);
    const shine = IconHammerShape.stroke('M8.5 6V26', ICON_HAMMER_HIGHLIGHT, 1, 'butt');
    return fill.defs + IconHammerShape.polygon(ICON_HAMMER_RUN_PLAY_TRIANGLE, fill.paint) + shine;
  }

  /**
   * Draws a monitor showing a blue game screen with a small play triangle.
   *
   * @param scope Id scope of the icon being rendered.
   * @returns Icon markup.
   */
  private preview(scope: IconHammerIdScope): string {
    const screen = IconHammerGradient.rampLit(scope, 'screen', ICON_HAMMER_RAMPS.cyan);
    const bezel = IconHammerShape.rect(1, 3, 30, 21, ICON_HAMMER_RAMPS.coal.base);
    const display = IconHammerShape.rect(3, 5, 26, 17, screen.paint);
    const stand = IconHammerShape.polygon(
      [12.5, 23.5, 19.5, 23.5, 21.5, 28.5, 10.5, 28.5],
      ICON_HAMMER_RAMPS.steel.base,
    );
    const play = IconHammerShape.polygon([13.5, 9.5, 21.5, 13.5, 13.5, 17.5], ICON_HAMMER_RAMPS.green.base);
    return screen.defs + bezel + display + stand + play;
  }

  /**
   * Draws the Model Context Protocol mark in black on a white tile.
   *
   * @param scope Id scope of the icon being rendered.
   * @returns Icon markup.
   */
  private mcp(scope: IconHammerIdScope): string {
    const paper = IconHammerGradient.rampLit(scope, 'tile', ICON_HAMMER_RAMPS.white);
    const tile = IconHammerShape.rect(1, 1, 30, 30, paper.paint, ICON_HAMMER_OUTLINE, 4);
    const mark = [
      'M18 84.8528L85.8822 16.9706C95.2548 7.59798 110.451 7.59798 119.823 16.9706C129.196 26.3431 129.196 41.5391 119.823 50.9117L68.5581 102.177',
      'M69.2652 101.47L119.823 50.9117C129.196 41.5391 144.392 41.5391 153.765 50.9117L154.118 51.2652C163.491 60.6378 163.491 75.8338 154.118 85.2063L92.7248 146.6C89.6006 149.724 89.6006 154.789 92.7248 157.913L105.331 170.52',
      'M102.853 33.9411L52.6482 84.1457C43.2756 93.5183 43.2756 108.714 52.6482 118.087C62.0208 127.459 77.2167 127.459 86.5893 118.087L136.794 67.8822',
    ].join('');
    const strokes = IconHammerShape.stroke(mark, ICON_HAMMER_OUTLINE, 14);
    return paper.defs + tile + IconHammerShape.group(strokes, 'translate(4 4) scale(0.1333)');
  }
}
