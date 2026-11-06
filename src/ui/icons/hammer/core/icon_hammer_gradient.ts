import type { IconHammerIdScope } from './icon_hammer_id_scope.js';
import type { IconHammerRamp } from './icon_hammer_palette.js';

/** Axis along which a gradient runs from its first to its last colour. */
export type IconHammerGradientDirection = 'diagonal' | 'vertical' | 'horizontal';

/** Gradient definition markup and the paint value that references it. */
export interface IconHammerFill {
  readonly defs: string;
  readonly paint: string;
}

const ICON_HAMMER_GRADIENT_VECTORS: Readonly<Record<IconHammerGradientDirection, string>> = {
  diagonal: 'x1="0" y1="0" x2="1" y2="1"',
  vertical: 'x1="0" y1="0" x2="0" y2="1"',
  horizontal: 'x1="0" y1="0" x2="1" y2="0"',
};

/** Builds the small linear gradients that shade the classic icons. */
export class IconHammerGradient {
  /**
   * Builds a two-stop linear gradient.
   *
   * @param scope Id scope of the icon being rendered.
   * @param localName Gradient name unique within the icon.
   * @param colorStart Colour at the start of the axis (lit side).
   * @param colorEnd Colour at the end of the axis (shaded side).
   * @param direction Axis of the gradient.
   * @returns Definition markup and paint reference.
   */
  static linear(
    scope: IconHammerIdScope,
    localName: string,
    colorStart: string,
    colorEnd: string,
    direction: IconHammerGradientDirection = 'diagonal',
  ): IconHammerFill {
    const vector = ICON_HAMMER_GRADIENT_VECTORS[direction];
    const stops = `<stop offset="0" stop-color="${colorStart}"/><stop offset="1" stop-color="${colorEnd}"/>`;
    const defs = `<defs><linearGradient id="${scope.idFor(localName)}" ${vector}>${stops}</linearGradient></defs>`;
    return { defs, paint: scope.urlFor(localName) };
  }

  /**
   * Builds a gradient from the light to the base tone of a ramp.
   *
   * @param scope Id scope of the icon being rendered.
   * @param localName Gradient name unique within the icon.
   * @param ramp Colour family.
   * @param direction Axis of the gradient.
   * @returns Definition markup and paint reference.
   */
  static rampLit(
    scope: IconHammerIdScope,
    localName: string,
    ramp: IconHammerRamp,
    direction: IconHammerGradientDirection = 'diagonal',
  ): IconHammerFill {
    return IconHammerGradient.linear(scope, localName, ramp.light, ramp.base, direction);
  }

  /**
   * Builds a gradient from the base to the dark tone of a ramp.
   *
   * @param scope Id scope of the icon being rendered.
   * @param localName Gradient name unique within the icon.
   * @param ramp Colour family.
   * @param direction Axis of the gradient.
   * @returns Definition markup and paint reference.
   */
  static rampShaded(
    scope: IconHammerIdScope,
    localName: string,
    ramp: IconHammerRamp,
    direction: IconHammerGradientDirection = 'diagonal',
  ): IconHammerFill {
    return IconHammerGradient.linear(scope, localName, ramp.base, ramp.dark, direction);
  }
}
