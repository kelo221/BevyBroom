import { IconHammerShape } from './icon_hammer_shape.js';
import { ICON_HAMMER_OUTLINE } from './icon_hammer_palette.js';

/** A point on the icon grid. */
export interface IconHammerPoint {
  readonly x: number;
  readonly y: number;
}

/** Draws outlined straight and curved arrows with triangular heads. */
export class IconHammerArrow {
  /**
   * Draws a straight arrow from a tail point to a tip point.
   *
   * @param tail Start of the shaft.
   * @param tip Point of the head.
   * @param fill Arrow colour.
   * @param shaftWidth Shaft width in pixels without the outline.
   * @returns Arrow markup.
   */
  static straight(tail: IconHammerPoint, tip: IconHammerPoint, fill: string, shaftWidth: number = 2): string {
    const head = IconHammerArrow.headPoints(tip, IconHammerArrow.directionFrom(tail, tip), shaftWidth);
    const shaft = `M${tail.x} ${tail.y}L${head.baseX} ${head.baseY}`;
    return IconHammerArrow.assemble(shaft, head.points, fill, shaftWidth);
  }

  /**
   * Draws a straight arrow with heads at both ends.
   *
   * @param start First tip.
   * @param end Second tip.
   * @param fill Arrow colour.
   * @param shaftWidth Shaft width in pixels without the outline.
   * @returns Arrow markup.
   */
  static double(start: IconHammerPoint, end: IconHammerPoint, fill: string, shaftWidth: number = 2): string {
    const endHead = IconHammerArrow.headPoints(end, IconHammerArrow.directionFrom(start, end), shaftWidth);
    const startHead = IconHammerArrow.headPoints(start, IconHammerArrow.directionFrom(end, start), shaftWidth);
    const shaft = `M${startHead.baseX} ${startHead.baseY}L${endHead.baseX} ${endHead.baseY}`;
    const outline = IconHammerShape.stroke(shaft, ICON_HAMMER_OUTLINE, shaftWidth + 2, 'butt');
    const heads = IconHammerShape.polygon(startHead.points, fill) + IconHammerShape.polygon(endHead.points, fill);
    return outline + heads + IconHammerShape.stroke(shaft, fill, shaftWidth, 'butt');
  }

  /**
   * Draws an arrow along a curved shaft ending in a head that points along a
   * direction at the shaft end.
   *
   * @param shaftPathData Path data of the shaft, ending at the head base.
   * @param shaftEnd Last point of the shaft path.
   * @param direction Unit direction the head points to.
   * @param fill Arrow colour.
   * @param shaftWidth Shaft width in pixels without the outline.
   * @returns Arrow markup.
   */
  static curved(
    shaftPathData: string,
    shaftEnd: IconHammerPoint,
    direction: IconHammerPoint,
    fill: string,
    shaftWidth: number,
  ): string {
    const headLength = shaftWidth * 2 + 2;
    const tip = { x: shaftEnd.x + direction.x * headLength, y: shaftEnd.y + direction.y * headLength };
    const head = IconHammerArrow.headPoints(tip, direction, shaftWidth);
    return IconHammerArrow.assemble(shaftPathData, head.points, fill, shaftWidth, 'round');
  }

  /**
   * Layers the shaft outline, the outlined head and the shaft fill so the head
   * outline does not cross the shaft.
   *
   * @param shaftPathData Path data of the shaft.
   * @param headPoints Corners of the head triangle.
   * @param fill Arrow colour.
   * @param shaftWidth Shaft width in pixels without the outline.
   * @param lineCap End cap of the shaft, `round` to reach into the head when
   *   the shaft stops at the head base.
   * @returns Arrow markup.
   */
  private static assemble(
    shaftPathData: string,
    headPoints: readonly number[],
    fill: string,
    shaftWidth: number,
    lineCap: string = 'butt',
  ): string {
    const outline = IconHammerShape.stroke(shaftPathData, ICON_HAMMER_OUTLINE, shaftWidth + 2, lineCap);
    const head = IconHammerShape.polygon(headPoints, fill);
    return outline + head + IconHammerShape.stroke(shaftPathData, fill, shaftWidth, lineCap);
  }

  /**
   * Returns the unit direction from one point to another.
   *
   * @param from Start point.
   * @param to End point.
   * @returns Unit direction, or +x for coincident points.
   */
  private static directionFrom(from: IconHammerPoint, to: IconHammerPoint): IconHammerPoint {
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    if (length === 0) {
      return { x: 1, y: 0 };
    }
    return { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
  }

  /**
   * Computes the head triangle behind a tip, sized from the shaft width.
   *
   * @param tip Point of the head.
   * @param direction Unit direction the head points to.
   * @param shaftWidth Shaft width in pixels without the outline.
   * @returns Head corners and the centre of the head base.
   */
  private static headPoints(
    tip: IconHammerPoint,
    direction: IconHammerPoint,
    shaftWidth: number,
  ): { points: number[]; baseX: number; baseY: number } {
    const headLength = shaftWidth * 2 + 2;
    const halfWidth = shaftWidth + 2;
    const baseX = tip.x - direction.x * headLength;
    const baseY = tip.y - direction.y * headLength;
    const sideX = -direction.y * halfWidth;
    const sideY = direction.x * halfWidth;
    const points = [tip.x, tip.y, baseX + sideX, baseY + sideY, baseX - sideX, baseY - sideY];
    return { points, baseX: baseX + direction.x, baseY: baseY + direction.y };
  }
}
