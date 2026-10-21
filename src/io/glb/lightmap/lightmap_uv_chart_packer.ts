/** Width and height of one chart, in meters. */
export interface LightmapChartSize {
  readonly width: number;
  readonly height: number;
}

/** Where every chart goes in the unit square. */
export interface LightmapChartPacking {
  /** Lower left corner of each chart in meters, two numbers per chart. */
  readonly offsets: Float32Array;
  /** Factor that turns packed meters into 0..1 lightmap coordinates. */
  readonly scale: number;
}

/**
 * How much wider than the square root of the total area the first shelf width
 * is.
 */
const LIGHTMAP_SHELF_WIDTH_SLACK = 1.1;

/** Shelf cursor while charts are placed. */
interface LightmapShelfCursor {
  x: number;
  y: number;
  shelfHeight: number;
  usedWidth: number;
}

/**
 * Packs chart rectangles into one square without overlap: tallest first into
 * rows (shelves) of a fixed width, with a gap of `padding` meters between
 * charts and around the border.
 */
export class LightmapUvChartPacker {
  /**
   * Packs charts.
   *
   * @param sizes Chart sizes in meters.
   * @param padding Gap between charts and around the border, in meters.
   * @returns Chart offsets and the scale into the unit square.
   */
  static pack(sizes: readonly LightmapChartSize[], padding: number): LightmapChartPacking {
    const offsets = new Float32Array(sizes.length * 2);
    const shelfWidth = LightmapUvChartPacker.shelfWidthChoose(sizes, padding);
    const cursor: LightmapShelfCursor = { x: padding, y: padding, shelfHeight: 0, usedWidth: 0 };
    for (const chart of LightmapUvChartPacker.tallestFirst(sizes)) {
      LightmapUvChartPacker.place(sizes[chart] ?? { width: 0, height: 0 }, chart, cursor, shelfWidth, padding, offsets);
    }
    const side = Math.max(cursor.usedWidth + padding, cursor.y + cursor.shelfHeight + padding, 1e-6);
    return { offsets, scale: 1 / side };
  }

  /**
   * Returns the shelf width: wide enough for the widest chart, and about the
   * side of a square holding every padded chart.
   *
   * @param sizes Chart sizes.
   * @param padding Gap between charts.
   * @returns Shelf width in meters, without the border.
   */
  private static shelfWidthChoose(sizes: readonly LightmapChartSize[], padding: number): number {
    let paddedArea = 0;
    let widest = 0;
    for (const size of sizes) {
      paddedArea += (size.width + padding) * (size.height + padding);
      widest = Math.max(widest, size.width + padding);
    }
    return Math.max(widest, Math.sqrt(paddedArea) * LIGHTMAP_SHELF_WIDTH_SLACK);
  }

  /**
   * Returns chart indices from tallest to shortest.
   *
   * @param sizes Chart sizes.
   * @returns Sorted chart indices.
   */
  private static tallestFirst(sizes: readonly LightmapChartSize[]): number[] {
    const order = sizes.map((_, index) => index);
    return order.sort((first, second) => (sizes[second]?.height ?? 0) - (sizes[first]?.height ?? 0));
  }

  /**
   * Places one chart on the current shelf, starting a new shelf when it does
   * not fit.
   *
   * @param size Chart size.
   * @param chart Chart index.
   * @param cursor Shelf cursor; advanced in place.
   * @param shelfWidth Shelf width without the border.
   * @param padding Gap between charts.
   * @param offsets Output offsets.
   */
  private static place(
    size: LightmapChartSize,
    chart: number,
    cursor: LightmapShelfCursor,
    shelfWidth: number,
    padding: number,
    offsets: Float32Array,
  ): void {
    if (cursor.x > padding && cursor.x + size.width > padding + shelfWidth) {
      cursor.x = padding;
      cursor.y += cursor.shelfHeight + padding;
      cursor.shelfHeight = 0;
    }
    offsets[chart * 2] = cursor.x;
    offsets[chart * 2 + 1] = cursor.y;
    cursor.x += size.width + padding;
    cursor.shelfHeight = Math.max(cursor.shelfHeight, size.height);
    cursor.usedWidth = Math.max(cursor.usedWidth, cursor.x - padding);
  }
}
