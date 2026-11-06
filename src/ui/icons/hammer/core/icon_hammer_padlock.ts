import { IconHammerGradient } from './icon_hammer_gradient.js';
import type { IconHammerIdScope } from './icon_hammer_id_scope.js';
import { ICON_HAMMER_RAMPS } from './icon_hammer_palette.js';
import { IconHammerShape } from './icon_hammer_shape.js';

/** Draws the small golden padlock that marks lock toggles. */
export class IconHammerPadlock {
  /**
   * Draws a 14 by 16 pixel padlock with its top left corner at an offset.
   *
   * @param scope Id scope of the icon being rendered.
   * @param left Left pixel column of the padlock.
   * @param top Top pixel row of the padlock.
   * @returns Padlock markup.
   */
  static draw(scope: IconHammerIdScope, left: number, top: number): string {
    const brass = IconHammerGradient.rampLit(scope, 'padlock-body', ICON_HAMMER_RAMPS.yellow);
    const shackle = IconHammerShape.band('M4 8V5.5A3 3 0 0 1 10 5.5V8', ICON_HAMMER_RAMPS.steel.base, 2, 'butt');
    const body = IconHammerShape.rect(1, 7, 12, 9, brass.paint);
    const keyhole = IconHammerShape.pixels(6, 10, 2, 3, ICON_HAMMER_RAMPS.coal.dark);
    return brass.defs + IconHammerShape.group(shackle + body + keyhole, `translate(${left} ${top})`);
  }
}
