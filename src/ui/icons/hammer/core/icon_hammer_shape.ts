import { ICON_HAMMER_OUTLINE } from './icon_hammer_palette.js';

/**
 * Emits the outlined SVG primitives of the classic icon set. Every outlined
 * shape gets a one pixel dark stroke with round joins.
 */
export class IconHammerShape {
  /**
   * Formats a flat list of x, y pairs as an SVG points attribute.
   *
   * @param coordinates Alternating x and y values.
   * @returns Points attribute text.
   */
  static pointsFormat(coordinates: readonly number[]): string {
    const pairs: string[] = [];
    for (let index = 0; index + 1 < coordinates.length; index += 2) {
      pairs.push(`${coordinates[index]},${coordinates[index + 1]}`);
    }
    return pairs.join(' ');
  }

  /**
   * Draws an outlined closed polygon.
   *
   * @param coordinates Alternating x and y values of the corners.
   * @param fill Fill paint.
   * @param stroke Outline colour, or `none`.
   * @returns Polygon markup.
   */
  static polygon(coordinates: readonly number[], fill: string, stroke: string = ICON_HAMMER_OUTLINE): string {
    const points = IconHammerShape.pointsFormat(coordinates);
    return `<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="1" stroke-linejoin="round"/>`;
  }

  /**
   * Draws an outlined rectangle covering whole pixels, the outline sitting on
   * the outermost pixel row and column.
   *
   * @param left Left pixel column.
   * @param top Top pixel row.
   * @param width Width in pixels.
   * @param height Height in pixels.
   * @param fill Fill paint.
   * @param stroke Outline colour, or `none`.
   * @param cornerRadius Corner rounding radius in pixels.
   * @returns Rectangle markup.
   */
  static rect(
    left: number,
    top: number,
    width: number,
    height: number,
    fill: string,
    stroke: string = ICON_HAMMER_OUTLINE,
    cornerRadius: number = 0,
  ): string {
    const box = `x="${left + 0.5}" y="${top + 0.5}" width="${width - 1}" height="${height - 1}" rx="${cornerRadius}"`;
    return `<rect ${box} fill="${fill}" stroke="${stroke}" stroke-width="1"/>`;
  }

  /**
   * Fills whole pixels without an outline.
   *
   * @param left Left pixel column.
   * @param top Top pixel row.
   * @param width Width in pixels.
   * @param height Height in pixels.
   * @param fill Fill paint.
   * @returns Rectangle markup.
   */
  static pixels(left: number, top: number, width: number, height: number, fill: string): string {
    return `<rect x="${left}" y="${top}" width="${width}" height="${height}" fill="${fill}"/>`;
  }

  /**
   * Draws an outlined closed or open path.
   *
   * @param pathData Path data.
   * @param fill Fill paint, or `none`.
   * @param stroke Outline colour, or `none`.
   * @returns Path markup.
   */
  static path(pathData: string, fill: string, stroke: string = ICON_HAMMER_OUTLINE): string {
    return `<path d="${pathData}" fill="${fill}" stroke="${stroke}" stroke-width="1" stroke-linejoin="round"/>`;
  }

  /**
   * Draws an unfilled stroke along a path.
   *
   * @param pathData Path data.
   * @param color Stroke colour.
   * @param width Stroke width in pixels.
   * @param lineCap Stroke end cap.
   * @returns Path markup.
   */
  static stroke(pathData: string, color: string, width: number = 1, lineCap: string = 'round'): string {
    const style = `stroke-width="${width}" stroke-linecap="${lineCap}" stroke-linejoin="round"`;
    return `<path d="${pathData}" fill="none" stroke="${color}" ${style}/>`;
  }

  /**
   * Draws an unfilled dashed stroke along a path.
   *
   * @param pathData Path data.
   * @param color Stroke colour.
   * @param dashPattern Dash and gap lengths, for example `2 2`.
   * @param width Stroke width in pixels.
   * @returns Path markup.
   */
  static strokeDashed(pathData: string, color: string, dashPattern: string, width: number = 1): string {
    return `<path d="${pathData}" fill="none" stroke="${color}" stroke-width="${width}" stroke-dasharray="${dashPattern}"/>`;
  }

  /**
   * Draws a thick band along a path with a dark outline on both sides.
   *
   * @param pathData Path data of the band centre line.
   * @param fill Band colour.
   * @param width Band width in pixels without the outline.
   * @param lineCap Band end cap.
   * @returns Markup of the outline stroke and the band stroke.
   */
  static band(pathData: string, fill: string, width: number, lineCap: string = 'round'): string {
    return (
      IconHammerShape.stroke(pathData, ICON_HAMMER_OUTLINE, width + 2, lineCap) +
      IconHammerShape.stroke(pathData, fill, width, lineCap)
    );
  }

  /**
   * Draws an outlined circle.
   *
   * @param centerX Centre x.
   * @param centerY Centre y.
   * @param radius Radius.
   * @param fill Fill paint.
   * @param stroke Outline colour, or `none`.
   * @returns Circle markup.
   */
  static circle(
    centerX: number,
    centerY: number,
    radius: number,
    fill: string,
    stroke: string = ICON_HAMMER_OUTLINE,
  ): string {
    return `<circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`;
  }

  /**
   * Draws a small outlined square handle centred on a half-pixel point.
   *
   * @param centerX Centre x on a half-pixel coordinate.
   * @param centerY Centre y on a half-pixel coordinate.
   * @param fill Handle fill.
   * @param sizePx Odd edge length in pixels.
   * @returns Rectangle markup.
   */
  static handle(centerX: number, centerY: number, fill: string, sizePx: number = 5): string {
    const half = (sizePx - 1) / 2;
    return IconHammerShape.rect(centerX - 0.5 - half, centerY - 0.5 - half, sizePx, sizePx, fill);
  }

  /**
   * Draws one handle on every point of a list.
   *
   * @param coordinates Alternating half-pixel x and y values.
   * @param fill Handle fill.
   * @param sizePx Odd edge length in pixels.
   * @returns Markup of all handles.
   */
  static handlesAt(coordinates: readonly number[], fill: string, sizePx: number = 5): string {
    let handles = '';
    for (let index = 0; index + 1 < coordinates.length; index += 2) {
      handles += IconHammerShape.handle(coordinates[index] ?? 0, coordinates[index + 1] ?? 0, fill, sizePx);
    }
    return handles;
  }

  /**
   * Wraps markup in a transformed group.
   *
   * @param content Inner markup.
   * @param transform SVG transform attribute value.
   * @returns Group markup.
   */
  static group(content: string, transform: string): string {
    return `<g transform="${transform}">${content}</g>`;
  }

  /**
   * Wraps markup in a group clipped to a clip path.
   *
   * @param content Inner markup.
   * @param clipUrl `url(#id)` reference of the clip path.
   * @returns Group markup.
   */
  static clipped(content: string, clipUrl: string): string {
    return `<g clip-path="${clipUrl}">${content}</g>`;
  }

  /**
   * Defines a polygonal clip path.
   *
   * @param clipId Element id of the clip path.
   * @param coordinates Alternating x and y values of the clip polygon.
   * @returns Clip path definition markup.
   */
  static clipPathPolygon(clipId: string, coordinates: readonly number[]): string {
    const points = IconHammerShape.pointsFormat(coordinates);
    return `<defs><clipPath id="${clipId}"><polygon points="${points}"/></clipPath></defs>`;
  }
}
