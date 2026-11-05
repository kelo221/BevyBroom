/**
 * Averages the values of a vertex and its up to eight grid neighbors (3x3
 * Laplacian window clamped at the grid border).
 *
 * @param values Row-major per-vertex values.
 * @param rowLength Vertices per grid side.
 * @param vertexIndex Center vertex index.
 * @returns Mean of the window.
 */
export function displacementNeighborhoodAverage(
  values: readonly number[],
  rowLength: number,
  vertexIndex: number,
): number {
  const row = Math.floor(vertexIndex / rowLength);
  const column = vertexIndex % rowLength;
  let sum = 0;
  let count = 0;
  for (let neighborRow = Math.max(0, row - 1); neighborRow <= Math.min(rowLength - 1, row + 1); neighborRow++) {
    for (
      let neighborColumn = Math.max(0, column - 1);
      neighborColumn <= Math.min(rowLength - 1, column + 1);
      neighborColumn++
    ) {
      sum += values[neighborRow * rowLength + neighborColumn] ?? 0;
      count += 1;
    }
  }
  return count > 0 ? sum / count : 0;
}

/**
 * Returns whether a vertex lies on the outer border of the grid.
 *
 * @param rowLength Vertices per grid side.
 * @param vertexIndex Vertex index.
 * @returns True on the first or last row or column.
 */
export function displacementVertexOnBorderIs(rowLength: number, vertexIndex: number): boolean {
  const row = Math.floor(vertexIndex / rowLength);
  const column = vertexIndex % rowLength;
  const last = rowLength - 1;
  return row === 0 || column === 0 || row === last || column === last;
}
