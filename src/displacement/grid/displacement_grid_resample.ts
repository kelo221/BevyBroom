/**
 * Samples a row-major grid of values at a fractional row and column with
 * bilinear interpolation, clamped to the grid.
 *
 * @param values Row-major per-vertex values.
 * @param rowLength Vertices per grid side.
 * @param row Fractional row.
 * @param column Fractional column.
 * @returns Interpolated value.
 */
export function displacementGridSampleBilinear(
  values: readonly number[],
  rowLength: number,
  row: number,
  column: number,
): number {
  const last = rowLength - 1;
  const rowLow = Math.min(last, Math.max(0, Math.floor(row)));
  const columnLow = Math.min(last, Math.max(0, Math.floor(column)));
  const rowHigh = Math.min(last, rowLow + 1);
  const columnHigh = Math.min(last, columnLow + 1);
  const rowBlend = Math.min(1, Math.max(0, row - rowLow));
  const columnBlend = Math.min(1, Math.max(0, column - columnLow));
  const top = displacementLerp(
    values[rowLow * rowLength + columnLow] ?? 0,
    values[rowLow * rowLength + columnHigh] ?? 0,
    columnBlend,
  );
  const bottom = displacementLerp(
    values[rowHigh * rowLength + columnLow] ?? 0,
    values[rowHigh * rowLength + columnHigh] ?? 0,
    columnBlend,
  );
  return displacementLerp(top, bottom, rowBlend);
}

/**
 * Resamples a row-major grid of values onto a grid with another side length
 * spanning the same face.
 *
 * @param values Source row-major values.
 * @param sourceRowLength Source vertices per side.
 * @param targetRowLength Target vertices per side.
 * @returns Target row-major values.
 */
export function displacementGridResample(
  values: readonly number[],
  sourceRowLength: number,
  targetRowLength: number,
): number[] {
  const ratio = (sourceRowLength - 1) / (targetRowLength - 1);
  const resampled: number[] = [];
  for (let row = 0; row < targetRowLength; row++) {
    for (let column = 0; column < targetRowLength; column++) {
      resampled.push(displacementGridSampleBilinear(values, sourceRowLength, row * ratio, column * ratio));
    }
  }
  return resampled;
}

/**
 * Linearly blends two numbers.
 *
 * @param from Value at blend 0.
 * @param to Value at blend 1.
 * @param blend Blend factor.
 * @returns Blended value.
 */
function displacementLerp(from: number, to: number, blend: number): number {
  return from + (to - from) * blend;
}
