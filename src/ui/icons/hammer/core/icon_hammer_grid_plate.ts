import { IconHammerShape } from './icon_hammer_shape.js';

/** Draws a flat outlined square plate ruled with grid lines. */
export class IconHammerGridPlate {
  /**
   * Draws the plate and its grid lines.
   *
   * @param left Left pixel column.
   * @param top Top pixel row.
   * @param size Edge length in pixels.
   * @param cellPx Grid spacing in pixels.
   * @param lineColor Grid line colour.
   * @param fill Plate fill paint.
   * @returns Plate markup.
   */
  static draw(left: number, top: number, size: number, cellPx: number, lineColor: string, fill: string): string {
    const plate = IconHammerShape.rect(left, top, size, size, fill);
    const lines = IconHammerShape.stroke(
      IconHammerGridPlate.linesPathData(left, top, size, cellPx),
      lineColor,
      1,
      'butt',
    );
    return plate + lines;
  }

  /**
   * Returns the vertical and horizontal grid lines inside the plate.
   *
   * @param left Left pixel column.
   * @param top Top pixel row.
   * @param size Edge length in pixels.
   * @param cellPx Grid spacing in pixels.
   * @returns Path data of the grid lines.
   */
  static linesPathData(left: number, top: number, size: number, cellPx: number): string {
    const inner = size - 2;
    let pathData = '';
    for (let offset = cellPx; offset < size - 1; offset += cellPx) {
      pathData += `M${left + offset + 0.5} ${top + 1}v${inner}M${left + 1} ${top + offset + 0.5}h${inner}`;
    }
    return pathData;
  }
}
