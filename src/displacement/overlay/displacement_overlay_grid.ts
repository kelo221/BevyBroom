import * as THREE from 'three';
import { displacementCellDiagonalRead } from '@/displacement/grid/displacement_cell_diagonal.js';
import type { DisplacementOverlayMaterials } from './displacement_overlay_materials.js';
import { DisplacementOverlayPart } from './displacement_overlay_part.js';

/**
 * Distance, in meters, the grid wireframe floats above the surface along each
 * vertex normal.
 */
export const DISPLACEMENT_OVERLAY_GRID_LIFT = 0.004;

/**
 * Lists the vertex index pairs of the grid lines of a row-major grid: every
 * segment along a row, then every segment along a column.
 *
 * @param rowLength Vertices per grid side.
 * @returns Flat list with two vertex indices per segment.
 */
export function displacementOverlayGridLinePairsBuild(rowLength: number): number[] {
  const pairs: number[] = [];
  for (let row = 0; row < rowLength; row++) {
    for (let column = 0; column < rowLength - 1; column++) {
      pairs.push(row * rowLength + column, row * rowLength + column + 1);
    }
  }
  for (let column = 0; column < rowLength; column++) {
    for (let row = 0; row < rowLength - 1; row++) {
      pairs.push(row * rowLength + column, (row + 1) * rowLength + column);
    }
  }
  return pairs;
}

/**
 * Lists the vertex index pairs of the cell diagonals of a row-major grid, one
 * per cell in row-major cell order, along the diagonal that splits the cell's
 * triangles.
 *
 * @param rowLength Vertices per grid side.
 * @returns Flat list with two vertex indices per cell.
 */
export function displacementOverlayGridDiagonalPairsBuild(rowLength: number): number[] {
  const pairs: number[] = [];
  for (let row = 0; row < rowLength - 1; row++) {
    for (let column = 0; column < rowLength - 1; column++) {
      const first = row * rowLength + column;
      if (displacementCellDiagonalRead(row, column) === 'main') {
        pairs.push(first, first + rowLength + 1);
      } else {
        pairs.push(first + 1, first + rowLength);
      }
    }
  }
  return pairs;
}

/**
 * Returns the grid side length of a displacement surface geometry.
 *
 * @param surfaceGeometry Row-major displacement surface geometry.
 * @returns Vertices per side, or 0 when the vertex count is no square of at
 *   least two.
 */
export function displacementOverlayGridRowLengthRead(surfaceGeometry: THREE.BufferGeometry): number {
  const count = surfaceGeometry.getAttribute('position')?.count ?? 0;
  const rowLength = Math.round(Math.sqrt(count));
  return rowLength >= 2 && rowLength * rowLength === count ? rowLength : 0;
}

/**
 * Hammer-style wireframe over one displacement surface: solid lines along the
 * grid rows and columns and dashed lines along the cell diagonals, lifted
 * slightly along the vertex normals so they do not fight the surface depth.
 */
export class DisplacementOverlayGrid extends DisplacementOverlayPart {
  /** Solid row and column lines. */
  readonly lines: THREE.LineSegments;
  /** Dashed cell diagonals. */
  readonly diagonals: THREE.LineSegments;

  /**
   * Creates the wireframe from two segment geometries.
   *
   * @param lines Row and column segments.
   * @param diagonals Diagonal segments.
   */
  private constructor(lines: THREE.LineSegments, diagonals: THREE.LineSegments) {
    super('displacement_overlay_grid', [lines, diagonals]);
    this.lines = lines;
    this.diagonals = diagonals;
  }

  /**
   * Builds the wireframe of a displacement surface geometry.
   *
   * @param surfaceGeometry Row-major displacement surface geometry with
   *   position and normal attributes.
   * @param materials Shared overlay materials.
   * @returns Grid wireframe, or null when the geometry is no displacement grid.
   */
  static create(
    surfaceGeometry: THREE.BufferGeometry,
    materials: DisplacementOverlayMaterials,
  ): DisplacementOverlayGrid | null {
    const rowLength = displacementOverlayGridRowLengthRead(surfaceGeometry);
    if (rowLength === 0) {
      return null;
    }
    const lifted = DisplacementOverlayGrid.liftedPositionsBuild(surfaceGeometry);
    const lineGeometry = DisplacementOverlayGrid.segmentGeometryBuild(
      lifted,
      displacementOverlayGridLinePairsBuild(rowLength),
    );
    const diagonalGeometry = DisplacementOverlayGrid.segmentGeometryBuild(
      lifted,
      displacementOverlayGridDiagonalPairsBuild(rowLength),
    );
    DisplacementOverlayGrid.lineDistancesPerSegmentWrite(diagonalGeometry);
    return new DisplacementOverlayGrid(
      new THREE.LineSegments(lineGeometry, materials.gridLine),
      new THREE.LineSegments(diagonalGeometry, materials.gridDiagonal),
    );
  }

  /**
   * Pushes every surface vertex along its normal by the grid lift.
   *
   * @param surfaceGeometry Surface geometry with position and normal
   *   attributes.
   * @returns Lifted XYZ positions, one triple per surface vertex.
   */
  private static liftedPositionsBuild(surfaceGeometry: THREE.BufferGeometry): Float32Array {
    const positions = surfaceGeometry.getAttribute('position');
    const normals = surfaceGeometry.getAttribute('normal');
    const lifted = new Float32Array(positions.count * 3);
    const lift = normals ? DISPLACEMENT_OVERLAY_GRID_LIFT : 0;
    for (let vertexIndex = 0; vertexIndex < positions.count; vertexIndex++) {
      lifted[vertexIndex * 3] = positions.getX(vertexIndex) + (normals?.getX(vertexIndex) ?? 0) * lift;
      lifted[vertexIndex * 3 + 1] = positions.getY(vertexIndex) + (normals?.getY(vertexIndex) ?? 0) * lift;
      lifted[vertexIndex * 3 + 2] = positions.getZ(vertexIndex) + (normals?.getZ(vertexIndex) ?? 0) * lift;
    }
    return lifted;
  }

  /**
   * Builds a non-indexed segment geometry from vertex index pairs.
   *
   * @param vertexPositions XYZ positions, one triple per grid vertex.
   * @param pairs Flat list with two vertex indices per segment.
   * @returns Geometry with two position entries per segment.
   */
  private static segmentGeometryBuild(vertexPositions: Float32Array, pairs: readonly number[]): THREE.BufferGeometry {
    const segmentPositions = new Float32Array(pairs.length * 3);
    pairs.forEach((vertexIndex, entryIndex) => {
      segmentPositions.set(vertexPositions.subarray(vertexIndex * 3, vertexIndex * 3 + 3), entryIndex * 3);
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(segmentPositions, 3));
    geometry.computeBoundingSphere();
    return geometry;
  }

  /**
   * Writes line distances running from 0 to 1 along every segment, so each
   * diagonal shows the same number of dashes whatever its cell size.
   *
   * @param segmentGeometry Non-indexed segment geometry.
   */
  private static lineDistancesPerSegmentWrite(segmentGeometry: THREE.BufferGeometry): void {
    const entryCount = segmentGeometry.getAttribute('position').count;
    const distances = new Float32Array(entryCount);
    for (let entryIndex = 1; entryIndex < entryCount; entryIndex += 2) {
      distances[entryIndex] = 1;
    }
    segmentGeometry.setAttribute('lineDistance', new THREE.BufferAttribute(distances, 1));
  }

  /** Releases both segment geometries. */
  protected geometriesDispose(): void {
    this.lines.geometry.dispose();
    this.diagonals.geometry.dispose();
  }
}
