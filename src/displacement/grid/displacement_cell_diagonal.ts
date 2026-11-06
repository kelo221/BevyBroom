/**
 * Diagonal splitting one grid cell into two triangles. 'main' joins the cell's
 * (row, column) vertex to its (row + 1, column + 1) vertex; 'anti' joins the
 * (row, column + 1) vertex to the (row + 1, column) vertex.
 */
export type DisplacementCellDiagonal = 'main' | 'anti';

/**
 * Returns the diagonal of a grid cell in the alternating diamond pattern: cells
 * whose row plus column is even use the main diagonal, odd cells the anti
 * diagonal, so neighboring cells always differ.
 *
 * @param row Cell row, from the first face corner towards the fourth.
 * @param column Cell column, from the first face corner towards the second.
 * @returns Diagonal of the cell.
 */
export function displacementCellDiagonalRead(row: number, column: number): DisplacementCellDiagonal {
  return (row + column) % 2 === 0 ? 'main' : 'anti';
}

/**
 * Appends the two triangles of one grid cell to an index list, split along the
 * cell's diagonal and wound in the face corners' order.
 *
 * @param rowLength Vertices per grid side.
 * @param row Cell row.
 * @param column Cell column.
 * @param indices Index list receiving six vertex indices.
 */
export function displacementCellTrianglesAppend(
  rowLength: number,
  row: number,
  column: number,
  indices: number[],
): void {
  const first = row * rowLength + column;
  const second = first + 1;
  const third = first + rowLength + 1;
  const fourth = first + rowLength;
  if (displacementCellDiagonalRead(row, column) === 'main') {
    indices.push(first, second, third, first, third, fourth);
    return;
  }
  indices.push(first, second, fourth, second, third, fourth);
}
