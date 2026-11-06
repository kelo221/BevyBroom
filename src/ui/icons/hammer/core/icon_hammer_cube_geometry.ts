/** Placement of an oblique cube on the icon pixel grid. */
export interface IconHammerCubeLayout {
  readonly left: number;
  readonly top: number;
  readonly size: number;
  readonly depth: number;
}

/**
 * Corner coordinates of an oblique cube: a square front face with the top and
 * right faces receding up and to the right. All corners sit on half pixels so
 * one pixel outlines stay crisp.
 */
export class IconHammerCubeGeometry {
  private readonly frontLeft: number;
  private readonly frontTop: number;
  private readonly frontRight: number;
  private readonly frontBottom: number;
  private readonly backRight: number;
  private readonly backTop: number;
  private readonly backLeft: number;
  private readonly backBottom: number;

  /**
   * Computes the cube corners from its layout.
   *
   * @param layout Pixel placement of the cube.
   */
  constructor(layout: IconHammerCubeLayout) {
    this.frontLeft = layout.left + 0.5;
    this.frontTop = layout.top + layout.depth + 0.5;
    this.frontRight = this.frontLeft + layout.size;
    this.frontBottom = this.frontTop + layout.size;
    this.backLeft = this.frontLeft + layout.depth;
    this.backRight = this.frontRight + layout.depth;
    this.backTop = this.frontTop - layout.depth;
    this.backBottom = this.frontBottom - layout.depth;
  }

  /**
   * Returns the corners of the front face.
   *
   * @returns Alternating x and y values.
   */
  frontPoints(): number[] {
    const left = this.frontLeft;
    const right = this.frontRight;
    return [left, this.frontTop, right, this.frontTop, right, this.frontBottom, left, this.frontBottom];
  }

  /**
   * Returns the corners of the top face.
   *
   * @returns Alternating x and y values.
   */
  topPoints(): number[] {
    const front = this.frontTop;
    const back = this.backTop;
    return [this.frontLeft, front, this.backLeft, back, this.backRight, back, this.frontRight, front];
  }

  /**
   * Returns the corners of the right face.
   *
   * @returns Alternating x and y values.
   */
  sidePoints(): number[] {
    const front = this.frontRight;
    const back = this.backRight;
    return [front, this.frontTop, back, this.backTop, back, this.backBottom, front, this.frontBottom];
  }

  /**
   * Returns the seven corners visible from the front, top and right.
   *
   * @returns Alternating x and y values.
   */
  visibleCornerPoints(): number[] {
    return [
      ...this.frontPoints(),
      this.backLeft,
      this.backTop,
      this.backRight,
      this.backTop,
      this.backRight,
      this.backBottom,
    ];
  }

  /**
   * Returns the three edges meeting at the hidden back corner as path data.
   *
   * @returns Path data of the three hidden edges.
   */
  hiddenEdgesPathData(): string {
    const corner = `M${this.backLeft} ${this.backBottom}`;
    const toFront = `${corner}L${this.frontLeft} ${this.frontBottom}`;
    return `${toFront}${corner}V${this.backTop}${corner}H${this.backRight}`;
  }

  /**
   * Returns the outer outline of the whole cube.
   *
   * @returns Alternating x and y values of the six silhouette corners.
   */
  silhouettePoints(): number[] {
    const left = this.frontLeft;
    const bottom = this.frontBottom;
    return [left, bottom, left, this.frontTop, this.backLeft, this.backTop, this.backRight, this.backTop].concat([
      this.backRight,
      this.backBottom,
      this.frontRight,
      bottom,
    ]);
  }

  /**
   * Returns lines that split every visible face into equal cells.
   *
   * @param divisions Number of cells along each face edge.
   * @returns Path data of the divider lines.
   */
  faceDividersPathData(divisions: number): string {
    let pathData = '';
    for (let step = 1; step < divisions; step += 1) {
      pathData += this.frontDividerPathData(step / divisions);
      pathData += this.recedingDividerPathData(step / divisions);
    }
    return pathData;
  }

  /**
   * Returns the vertical and horizontal front face lines at one fraction of the
   * face, each continued over the top or right face.
   *
   * @param fraction Position along the face from its left or top edge.
   * @returns Path data of the two lines.
   */
  private frontDividerPathData(fraction: number): string {
    const x = this.frontLeft + (this.frontRight - this.frontLeft) * fraction;
    const y = this.frontTop + (this.frontBottom - this.frontTop) * fraction;
    const depth = this.backRight - this.frontRight;
    const vertical = `M${x} ${this.frontBottom}V${this.frontTop}L${x + depth} ${this.backTop}`;
    const horizontal = `M${this.frontLeft} ${y}H${this.frontRight}L${this.backRight} ${y - depth}`;
    return vertical + horizontal;
  }

  /**
   * Returns the lines of the top and right faces parallel to the front face at
   * one fraction of the cube depth.
   *
   * @param fraction Position along the depth from the front face.
   * @returns Path data of the line over the top and down the right face.
   */
  private recedingDividerPathData(fraction: number): string {
    const offset = (this.backRight - this.frontRight) * fraction;
    const start = `M${this.frontLeft + offset} ${this.frontTop - offset}`;
    return `${start}H${this.frontRight + offset}V${this.frontBottom - offset}`;
  }

  /**
   * Returns the front face box in whole pixels.
   *
   * @returns Left, top and edge length of the front face.
   */
  frontBox(): { left: number; top: number; size: number } {
    return { left: this.frontLeft - 0.5, top: this.frontTop - 0.5, size: this.frontRight - this.frontLeft + 1 };
  }
}
