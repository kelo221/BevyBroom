import { IconHammerGradient } from './icon_hammer_gradient.js';
import type { IconHammerIdScope } from './icon_hammer_id_scope.js';
import { ICON_HAMMER_HIGHLIGHT, ICON_HAMMER_RAMPS } from './icon_hammer_palette.js';
import { IconHammerShape } from './icon_hammer_shape.js';

/** Draws the glowing yellow light bulb that marks entities. */
export class IconHammerBulb {
  /**
   * Draws the bulb filling the 32 by 32 icon grid.
   *
   * @param scope Id scope of the icon being rendered.
   * @returns Bulb markup.
   */
  static draw(scope: IconHammerIdScope): string {
    const glow = IconHammerGradient.linear(scope, 'bulb-glass', '#fffbe0', ICON_HAMMER_RAMPS.yellow.base);
    const glass = IconHammerShape.path('M10.5 19.75A9.5 9.5 0 1 1 21.5 19.75V22.5H10.5Z', glow.paint);
    const filament = IconHammerShape.stroke(
      'M13.5 21V14.5L15 16.5L16.5 14.5L18 16.5V21',
      ICON_HAMMER_RAMPS.orange.dark,
    );
    const shine = IconHammerShape.stroke('M10.5 12A5.5 5.5 0 0 1 15 6.5', ICON_HAMMER_HIGHLIGHT, 1.5);
    return glow.defs + glass + filament + shine + IconHammerBulb.socket(scope);
  }

  /**
   * Draws the threaded metal socket and contact tip under the glass.
   *
   * @param scope Id scope of the icon being rendered.
   * @returns Socket markup.
   */
  private static socket(scope: IconHammerIdScope): string {
    const metal = IconHammerGradient.rampLit(scope, 'bulb-socket', ICON_HAMMER_RAMPS.steel, 'horizontal');
    const body = IconHammerShape.rect(10, 22, 12, 6, metal.paint);
    const threads = IconHammerShape.stroke('M11 24.5H21M11 26.5H21', ICON_HAMMER_RAMPS.steel.dark, 1, 'butt');
    const tip = IconHammerShape.polygon([12.5, 27.5, 19.5, 27.5, 17.5, 30.5, 14.5, 30.5], ICON_HAMMER_RAMPS.coal.base);
    return metal.defs + body + threads + tip;
  }
}
