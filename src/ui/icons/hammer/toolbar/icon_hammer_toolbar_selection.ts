import { IconHammerArrow } from '../core/icon_hammer_arrow.js';
import { IconHammerBulb } from '../core/icon_hammer_bulb.js';
import { IconHammerCube } from '../core/icon_hammer_cube.js';
import { IconHammerGroup, type IconHammerDrawer } from '../core/icon_hammer_group.js';
import type { IconHammerIdScope } from '../core/icon_hammer_id_scope.js';
import { ICON_HAMMER_OUTLINE, ICON_HAMMER_RAMPS } from '../core/icon_hammer_palette.js';
import { IconHammerPadlock } from '../core/icon_hammer_padlock.js';
import { IconHammerShape } from '../core/icon_hammer_shape.js';
import { IconHammerTextureTile } from '../core/icon_hammer_texture_tile.js';

/** Names of the selection mode, picking and texture lock toolbar icons. */
export type IconHammerToolbarSelectionName =
  | 'selection_groups'
  | 'selection_objects'
  | 'selection_solids'
  | 'selection_ignore_groups'
  | 'selection_eyedropper'
  | 'texture_lock_position'
  | 'texture_lock_stretch';

/** Toolbar icons for what a click selects, picking and texture locks. */
export class IconHammerToolbarSelection extends IconHammerGroup<IconHammerToolbarSelectionName> {
  /**
   * Returns the drawer of every icon in the group.
   *
   * @returns Drawers keyed by icon name.
   */
  drawersRead(): Readonly<Record<IconHammerToolbarSelectionName, IconHammerDrawer>> {
    return {
      selection_groups: (scope) => this.groups(scope),
      selection_objects: (scope) => this.objects(scope),
      selection_solids: (scope) =>
        IconHammerCube.shaded(scope, 'solid', { left: 4, top: 4, size: 17, depth: 8 }, ICON_HAMMER_RAMPS.blue),
      selection_ignore_groups: (scope) => this.groups(scope) + this.prohibition(),
      selection_eyedropper: () => this.eyedropper(),
      texture_lock_position: (scope) =>
        IconHammerTextureTile.draw(scope, 2, 2, 20) + IconHammerPadlock.draw(scope, 17, 15),
      texture_lock_stretch: (scope) => this.textureLockStretch(scope),
    };
  }

  /**
   * Draws two cubes held together by a dashed group frame.
   *
   * @param scope Id scope of the icon being rendered.
   * @returns Icon markup.
   */
  private groups(scope: IconHammerIdScope): string {
    const frame = IconHammerShape.strokeDashed('M2.5 2.5H29.5V29.5H2.5Z', ICON_HAMMER_OUTLINE, '3 2');
    const back = IconHammerCube.shaded(
      scope,
      'first',
      { left: 5, top: 5, size: 10, depth: 4 },
      ICON_HAMMER_RAMPS.steel,
    );
    const front = IconHammerCube.shaded(
      scope,
      'second',
      { left: 13, top: 13, size: 10, depth: 4 },
      ICON_HAMMER_RAMPS.brick,
    );
    return frame + back + front;
  }

  /**
   * Draws a brick cube with an entity bulb beside it.
   *
   * @param scope Id scope of the icon being rendered.
   * @returns Icon markup.
   */
  private objects(scope: IconHammerIdScope): string {
    const cube = IconHammerCube.shaded(
      scope,
      'solid',
      { left: 2, top: 12, size: 13, depth: 5 },
      ICON_HAMMER_RAMPS.brick,
    );
    const bulb = IconHammerShape.group(IconHammerBulb.draw(scope), 'translate(14 1) scale(0.55)');
    return cube + bulb;
  }

  /**
   * Draws the red no-entry ring with a slash.
   *
   * @returns Ring markup.
   */
  private prohibition(): string {
    const ring = IconHammerShape.band('M28 16A12 12 0 1 1 4 16A12 12 0 1 1 28 16Z', ICON_HAMMER_RAMPS.red.base, 2.5);
    return ring + IconHammerShape.band('M7.5 7.5L24.5 24.5', ICON_HAMMER_RAMPS.red.base, 2.5, 'butt');
  }

  /**
   * Draws the glass eyedropper with a black bulb and a blue drop.
   *
   * @returns Icon markup.
   */
  private eyedropper(): string {
    const bulb = IconHammerShape.band('M23.5 8.5L27 5', ICON_HAMMER_RAMPS.coal.base, 5);
    const collar = IconHammerShape.band('M18.5 9.5L22.5 13.5', ICON_HAMMER_RAMPS.steel.light, 3, 'butt');
    const tube = IconHammerShape.band('M20 12L8 24', ICON_HAMMER_RAMPS.glass.base, 3, 'butt');
    const tip = IconHammerShape.band('M8 24L5.5 26.5', ICON_HAMMER_RAMPS.steel.base, 1);
    const drop = IconHammerShape.circle(4.5, 28.5, 2, ICON_HAMMER_RAMPS.blue.base);
    return bulb + collar + tube + tip + drop;
  }

  /**
   * Draws the texture swatch with a stretching arrow and a padlock.
   *
   * @param scope Id scope of the icon being rendered.
   * @returns Icon markup.
   */
  private textureLockStretch(scope: IconHammerIdScope): string {
    const swatch = IconHammerTextureTile.draw(scope, 2, 2, 20);
    const stretch = IconHammerArrow.double({ x: 4, y: 20 }, { x: 20, y: 4 }, ICON_HAMMER_RAMPS.blue.base, 2);
    return swatch + stretch + IconHammerPadlock.draw(scope, 17, 15);
  }
}
