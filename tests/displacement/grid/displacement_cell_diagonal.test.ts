import { describe, expect, it } from 'vitest';
import { DISPLACEMENT_POWERS } from '@/displacement/model/displacement_types.js';
import { displacementRowLength } from '@/displacement/model/displacement_face_surface.js';
import {
  displacementCellDiagonalRead,
  displacementCellTrianglesAppend,
} from '@/displacement/grid/displacement_cell_diagonal.js';
import { DisplacementMeshBuilder } from '@/displacement/mesh/displacement_mesh_builder.js';

/**
 * Lists the vertex indices of the four corners of a grid cell.
 *
 * @param rowLength Vertices per grid side.
 * @param row Cell row.
 * @param column Cell column.
 * @returns Corner indices in face winding order.
 */
function diagonalTestCellCorners(rowLength: number, row: number, column: number): number[] {
  const first = row * rowLength + column;
  return [first, first + 1, first + rowLength + 1, first + rowLength];
}

/**
 * Returns the vertex pair two triangles of a cell share.
 *
 * @param triangles Six indices: two triangles of one cell.
 * @returns Sorted shared vertex indices.
 */
function diagonalTestSharedEdge(triangles: readonly number[]): number[] {
  const firstTriangle = triangles.slice(0, 3);
  return triangles
    .slice(3)
    .filter((vertex) => firstTriangle.includes(vertex))
    .sort((left, right) => left - right);
}

/** Hammer style alternating cell diagonals of displacement grids. */
describe('displacement cell diagonal', () => {
  it('alternates the diagonal between every pair of neighboring cells', () => {
    const cellsPerSide = displacementRowLength(4) - 1;
    for (let row = 0; row < cellsPerSide; row++) {
      for (let column = 0; column < cellsPerSide - 1; column++) {
        expect(displacementCellDiagonalRead(row, column)).not.toBe(displacementCellDiagonalRead(row, column + 1));
        expect(displacementCellDiagonalRead(column, row)).not.toBe(displacementCellDiagonalRead(column + 1, row));
      }
    }
  });

  it('splits each cell into two triangles over its four corners along its own diagonal', () => {
    const rowLength = displacementRowLength(3);
    for (let row = 0; row < rowLength - 1; row++) {
      for (let column = 0; column < rowLength - 1; column++) {
        const triangles: number[] = [];
        displacementCellTrianglesAppend(rowLength, row, column, triangles);
        const corners = diagonalTestCellCorners(rowLength, row, column);
        expect(triangles).toHaveLength(6);
        expect(new Set(triangles)).toEqual(new Set(corners));
        const [first = -1, second = -1, third = -1, fourth = -1] = corners;
        const expectedDiagonal =
          displacementCellDiagonalRead(row, column) === 'main' ? [first, third] : [second, fourth];
        expect(diagonalTestSharedEdge(triangles)).toEqual(expectedDiagonal.sort((left, right) => left - right));
      }
    }
  });

  it('builds mesh indices that cover every cell with both diagonals in use', () => {
    DISPLACEMENT_POWERS.forEach((power) => {
      const rowLength = displacementRowLength(power);
      const indices = DisplacementMeshBuilder.indicesBuild(rowLength);
      const cellsPerSide = rowLength - 1;
      expect(indices).toHaveLength(cellsPerSide * cellsPerSide * 6);
      const diagonals = new Set<string>();
      for (let cell = 0; cell < cellsPerSide * cellsPerSide; cell++) {
        const row = Math.floor(cell / cellsPerSide);
        const column = cell % cellsPerSide;
        const cellIndices = indices.slice(cell * 6, cell * 6 + 6);
        expect(new Set(cellIndices)).toEqual(new Set(diagonalTestCellCorners(rowLength, row, column)));
        diagonals.add(displacementCellDiagonalRead(row, column));
      }
      expect([...diagonals].sort()).toEqual(['anti', 'main']);
    });
  });
});
