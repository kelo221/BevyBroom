import { IconHammerCube } from '../core/icon_hammer_cube.js';
import { IconHammerCubeGeometry, type IconHammerCubeLayout } from '../core/icon_hammer_cube_geometry.js';
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

/** Names of the viewport shading and framing toolbar icons. */
export type IconHammerToolbarViewName =
  | 'view_shading_solid'
  | 'view_shading_wireframe'
  | 'view_shading_flat'
  | 'view_content_wireframes'
  | 'view_fit'
  | 'view_maximize';

/** Placement of the cube every shading icon shows. */
const ICON_HAMMER_VIEW_CUBE: IconHammerCubeLayout = { left: 4, top: 4, size: 17, depth: 8 };

/** Toolbar icons that switch viewport shading and frame or maximize a view. */
export class IconHammerToolbarView extends IconHammerGroup<IconHammerToolbarViewName> {
  /**
   * Returns the drawer of every icon in the group.
   *
   * @returns Drawers keyed by icon name.
   */
  drawersRead(): Readonly<Record<IconHammerToolbarViewName, IconHammerDrawer>> {
    const blue = ICON_HAMMER_RAMPS.blue.base;
    return {
      view_shading_solid: (scope) =>
        IconHammerCube.shaded(scope, 'cube', ICON_HAMMER_VIEW_CUBE, ICON_HAMMER_RAMPS.blue),
      view_shading_wireframe: () =>
        IconHammerCube.wireframe(ICON_HAMMER_VIEW_CUBE, ICON_HAMMER_OUTLINE, ICON_HAMMER_OUTLINE_SOFT),
      view_shading_flat: () => IconHammerCube.flat(ICON_HAMMER_VIEW_CUBE, { top: blue, front: blue, side: blue }),
      view_content_wireframes: (scope) => this.contentWireframes(scope),
      view_fit: (scope) => this.fit(scope),
      view_maximize: (scope) => this.maximize(scope),
    };
  }

  /**
   * Draws a steel cube with its visible and hidden edges traced in orange
   * inside a dark silhouette.
   *
   * @param scope Id scope of the icon being rendered.
   * @returns Icon markup.
   */
  private contentWireframes(scope: IconHammerIdScope): string {
    const solid = IconHammerCube.shaded(scope, 'cube', ICON_HAMMER_VIEW_CUBE, ICON_HAMMER_RAMPS.steel);
    const orange = ICON_HAMMER_RAMPS.orange.base;
    const edges = IconHammerCube.wireframe(ICON_HAMMER_VIEW_CUBE, orange, orange);
    const silhouette = new IconHammerCubeGeometry(ICON_HAMMER_VIEW_CUBE).silhouettePoints();
    return solid + edges + IconHammerShape.polygon(silhouette, 'none');
  }

  /**
   * Draws blue framing corners around a small red cube.
   *
   * @param scope Id scope of the icon being rendered.
   * @returns Icon markup.
   */
  private fit(scope: IconHammerIdScope): string {
    const corners = 'M3 11V3H11M21 3H29V11M29 21V29H21M11 29H3V21';
    const brackets = IconHammerShape.band(corners, ICON_HAMMER_RAMPS.blue.base, 2, 'square');
    return (
      brackets + IconHammerCube.shaded(scope, 'target', { left: 9, top: 9, size: 10, depth: 4 }, ICON_HAMMER_RAMPS.red)
    );
  }

  /**
   * Draws a window with a blue title bar and a maximize box.
   *
   * @param scope Id scope of the icon being rendered.
   * @returns Icon markup.
   */
  private maximize(scope: IconHammerIdScope): string {
    const title = IconHammerGradient.linear(
      scope,
      'title',
      ICON_HAMMER_RAMPS.blue.dark,
      ICON_HAMMER_RAMPS.blue.light,
      'horizontal',
    );
    const frame = IconHammerShape.rect(2, 3, 28, 26, ICON_HAMMER_HIGHLIGHT);
    const bar = IconHammerShape.pixels(3, 4, 26, 6, title.paint);
    const box = IconHammerShape.rect(21, 5, 6, 4, ICON_HAMMER_HIGHLIGHT);
    const pane = IconHammerShape.rect(6, 13, 20, 13, ICON_HAMMER_RAMPS.white.base, ICON_HAMMER_OUTLINE_SOFT);
    return title.defs + frame + bar + box + pane;
  }
}
