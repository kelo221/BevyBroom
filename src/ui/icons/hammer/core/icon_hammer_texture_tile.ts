import { IconHammerGradient } from './icon_hammer_gradient.js';
import type { IconHammerIdScope } from './icon_hammer_id_scope.js';
import { ICON_HAMMER_RAMPS } from './icon_hammer_palette.js';
import { IconHammerShape } from './icon_hammer_shape.js';

/** Draws the yellow and orange checkered texture swatch of the classic set. */
export class IconHammerTextureTile {
  /**
   * Draws a square swatch split into four checkered cells.
   *
   * @param scope Id scope of the icon being rendered.
   * @param left Left pixel column.
   * @param top Top pixel row.
   * @param size Even edge length in pixels.
   * @returns Swatch markup.
   */
  static draw(scope: IconHammerIdScope, left: number, top: number, size: number): string {
    const light = IconHammerGradient.rampLit(scope, 'tile-light', ICON_HAMMER_RAMPS.yellow);
    const half = size / 2;
    const plate = IconHammerShape.rect(left, top, size, size, light.paint);
    const dividerPath = `M${left + half - 0.5} ${top + 1}v${size - 2}M${left + 1} ${top + half - 0.5}h${size - 2}`;
    const dividers = IconHammerShape.stroke(dividerPath, ICON_HAMMER_RAMPS.orange.dark, 1, 'butt');
    return light.defs + plate + IconHammerTextureTile.checkerCells(left, top, size, half - 1) + dividers;
  }

  /**
   * Fills the top left and bottom right cells inside an outlined square split
   * by one divider row and column with the dark checker colour.
   *
   * @param left Left pixel column of the outlined square.
   * @param top Top pixel row of the outlined square.
   * @param size Edge length in pixels including the outline.
   * @param dividerOffset Pixel offset of the divider row and column from the
   *   left and top outline.
   * @returns Markup of the two dark cells.
   */
  static checkerCells(left: number, top: number, size: number, dividerOffset: number): string {
    const nearCell = dividerOffset - 1;
    const farCell = size - 2 - dividerOffset;
    const far = dividerOffset + 1;
    const color = ICON_HAMMER_RAMPS.orange.base;
    return (
      IconHammerShape.pixels(left + 1, top + 1, nearCell, nearCell, color) +
      IconHammerShape.pixels(left + far, top + far, farCell, farCell, color)
    );
  }
}
