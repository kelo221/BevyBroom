import { IconHammerBulb } from '../core/icon_hammer_bulb.js';
import { IconHammerCube } from '../core/icon_hammer_cube.js';
import { IconHammerCubeGeometry } from '../core/icon_hammer_cube_geometry.js';
import { IconHammerGradient } from '../core/icon_hammer_gradient.js';
import { IconHammerGroup, type IconHammerDrawer } from '../core/icon_hammer_group.js';
import type { IconHammerIdScope } from '../core/icon_hammer_id_scope.js';
import { ICON_HAMMER_HIGHLIGHT, ICON_HAMMER_RAMPS } from '../core/icon_hammer_palette.js';
import { IconHammerShape } from '../core/icon_hammer_shape.js';

/** Names of the palette tools that pick, look at and place things. */
export type IconHammerToolsSelectName =
  'tool_selection' | 'tool_magnify' | 'tool_camera' | 'tool_entity' | 'tool_vertex' | 'tool_path';

/** Left palette tools that select, inspect, place entities and edit vertices. */
export class IconHammerToolsSelect extends IconHammerGroup<IconHammerToolsSelectName> {
  /**
   * Returns the drawer of every icon in the group.
   *
   * @returns Drawers keyed by icon name.
   */
  drawersRead(): Readonly<Record<IconHammerToolsSelectName, IconHammerDrawer>> {
    return {
      tool_selection: (scope) => this.selection(scope),
      tool_magnify: (scope) => this.magnify(scope),
      tool_camera: (scope) => this.camera(scope),
      tool_entity: (scope) => IconHammerBulb.draw(scope),
      tool_vertex: (scope) => this.vertex(scope),
      tool_path: () => this.path(),
    };
  }

  /**
   * Draws the red selection arrow pointer.
   *
   * @param scope Id scope of the icon being rendered.
   * @returns Icon markup.
   */
  private selection(scope: IconHammerIdScope): string {
    const fill = IconHammerGradient.rampShaded(scope, 'arrow', ICON_HAMMER_RAMPS.red);
    const outline = [8.5, 3.5, 8.5, 25.5, 13.5, 20.5, 17.5, 28.5, 21.5, 26.5, 17.5, 19.5, 24.5, 19.5];
    const shine = IconHammerShape.stroke('M9.5 6.5V22.5', ICON_HAMMER_HIGHLIGHT, 1, 'butt');
    return fill.defs + IconHammerShape.polygon(outline, fill.paint) + shine;
  }

  /**
   * Draws the magnifying glass with a steel rim and a dark handle.
   *
   * @param scope Id scope of the icon being rendered.
   * @returns Icon markup.
   */
  private magnify(scope: IconHammerIdScope): string {
    const glass = IconHammerGradient.rampLit(scope, 'glass', ICON_HAMMER_RAMPS.glass);
    const rim = IconHammerGradient.rampLit(scope, 'rim', ICON_HAMMER_RAMPS.steel);
    const handle = IconHammerShape.band('M20 20L27 27', ICON_HAMMER_RAMPS.coal.base, 4);
    const rimCircle = IconHammerShape.circle(13, 13, 10, rim.paint);
    const lens = IconHammerShape.circle(13, 13, 7, glass.paint);
    const shine = IconHammerShape.stroke('M8.5 13A4.5 4.5 0 0 1 13 8.5', ICON_HAMMER_HIGHLIGHT, 1.5);
    return glass.defs + rim.defs + handle + rimCircle + lens + shine;
  }

  /**
   * Draws the black movie camera with red film reels.
   *
   * @param scope Id scope of the icon being rendered.
   * @returns Icon markup.
   */
  private camera(scope: IconHammerIdScope): string {
    const body = IconHammerGradient.linear(scope, 'body', ICON_HAMMER_RAMPS.coal.light, ICON_HAMMER_RAMPS.coal.dark);
    const reel = IconHammerGradient.rampLit(scope, 'reel', ICON_HAMMER_RAMPS.red);
    const lens = IconHammerGradient.rampLit(scope, 'lens', ICON_HAMMER_RAMPS.steel, 'vertical');
    const reels =
      IconHammerShape.circle(8.5, 8.5, 5, reel.paint) +
      IconHammerShape.circle(19.5, 8.5, 5, reel.paint) +
      IconHammerShape.circle(8.5, 8.5, 1.5, ICON_HAMMER_RAMPS.coal.base) +
      IconHammerShape.circle(19.5, 8.5, 1.5, ICON_HAMMER_RAMPS.coal.base);
    const housing = IconHammerShape.rect(2, 13, 21, 14, body.paint);
    const lensCone = IconHammerShape.polygon([22.5, 17.5, 29.5, 13.5, 29.5, 26.5, 22.5, 22.5], lens.paint);
    const lamp = IconHammerShape.circle(6.5, 17.5, 1.5, ICON_HAMMER_RAMPS.red.light, 'none');
    return body.defs + reel.defs + lens.defs + reels + housing + lensCone + lamp;
  }

  /**
   * Draws the white cube with a red handle on every visible corner.
   *
   * @param scope Id scope of the icon being rendered.
   * @returns Icon markup.
   */
  private vertex(scope: IconHammerIdScope): string {
    const layout = { left: 5, top: 4, size: 17, depth: 7 };
    const cube = IconHammerCube.shaded(scope, 'cube', layout, ICON_HAMMER_RAMPS.white);
    const corners = new IconHammerCubeGeometry(layout).visibleCornerPoints();
    return cube + IconHammerShape.handlesAt(corners, ICON_HAMMER_RAMPS.red.base);
  }

  /**
   * Draws the green path line with yellow corner nodes and a red end node.
   *
   * @returns Icon markup.
   */
  private path(): string {
    const route = IconHammerShape.band('M5.5 26.5L11.5 12.5L20.5 20.5L26.5 5.5', ICON_HAMMER_RAMPS.green.base, 3);
    const nodes =
      IconHammerShape.handle(5.5, 26.5, ICON_HAMMER_RAMPS.yellow.base) +
      IconHammerShape.handle(11.5, 12.5, ICON_HAMMER_RAMPS.yellow.base) +
      IconHammerShape.handle(20.5, 20.5, ICON_HAMMER_RAMPS.yellow.base) +
      IconHammerShape.handle(26.5, 5.5, ICON_HAMMER_RAMPS.red.base);
    return route + nodes;
  }
}
