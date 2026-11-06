import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { DISPLACEMENT_POWERS, type DisplacementPower } from '@/displacement/model/displacement_types.js';
import { displacementCellDiagonalRead } from '@/displacement/grid/displacement_cell_diagonal.js';
import { DisplacementMeshBuilder } from '@/displacement/mesh/displacement_mesh_builder.js';
import { DisplacementOverlayMaterials } from '@/displacement/overlay/displacement_overlay_materials.js';
import {
  DISPLACEMENT_OVERLAY_GRID_LIFT,
  DisplacementOverlayGrid,
  displacementOverlayGridDiagonalPairsBuild,
  displacementOverlayGridLinePairsBuild,
  displacementOverlayGridRowLengthRead,
} from '@/displacement/overlay/displacement_overlay_grid.js';
import {
  displacementTestBoxAdd,
  displacementTestCreate,
  displacementTestFaceFacing,
  displacementTestRigCreate,
  displacementTestSurfaceMeshFind,
  displacementTestTarget,
} from '../displacement_test_rig.js';

const materials = new DisplacementOverlayMaterials();

/**
 * Builds a displaced top face of a fresh box and returns its surface mesh.
 *
 * @param power Subdivision power of the displacement.
 * @returns Displacement surface mesh.
 */
function gridTestSurfaceMeshBuild(power: DisplacementPower): THREE.Mesh {
  const rig = displacementTestRigCreate(`OverlayGrid${power}`);
  const brush = displacementTestBoxAdd(rig, new THREE.Vector3(3, 2, 5), new THREE.Vector3(2, -1, 4));
  const target = displacementTestTarget(rig, brush, displacementTestFaceFacing(brush, new THREE.Vector3(0, 1, 0)));
  displacementTestCreate(rig, target, power);
  const surfaceMesh = displacementTestSurfaceMeshFind(rig, target);
  if (!surfaceMesh) throw new Error('displaced face has no surface mesh');
  return surfaceMesh;
}

/**
 * Builds the grid wireframe of a surface mesh.
 *
 * @param surfaceMesh Displacement surface mesh.
 * @returns Grid wireframe.
 */
function gridTestCreate(surfaceMesh: THREE.Mesh): DisplacementOverlayGrid {
  const grid = DisplacementOverlayGrid.create(surfaceMesh.geometry, materials);
  if (!grid) throw new Error('surface geometry is no displacement grid');
  return grid;
}

/**
 * Returns the surface vertex position pushed along its normal by the grid lift.
 *
 * @param geometry Surface geometry.
 * @param vertexIndex Vertex index.
 * @returns Lifted position.
 */
function gridTestLiftedVertexRead(geometry: THREE.BufferGeometry, vertexIndex: number): THREE.Vector3 {
  const position = new THREE.Vector3().fromBufferAttribute(geometry.getAttribute('position'), vertexIndex);
  const normal = new THREE.Vector3().fromBufferAttribute(geometry.getAttribute('normal'), vertexIndex);
  return position.addScaledVector(normal, DISPLACEMENT_OVERLAY_GRID_LIFT);
}

/**
 * Returns the triangle vertex index triples of one grid cell from the mesh
 * triangulation.
 *
 * @param rowLength Vertices per grid side.
 * @param cellIndex Row-major cell index.
 * @returns Both triangles of the cell.
 */
function gridTestCellTrianglesRead(rowLength: number, cellIndex: number): number[][] {
  const indices = DisplacementMeshBuilder.indicesBuild(rowLength);
  return [indices.slice(cellIndex * 6, cellIndex * 6 + 3), indices.slice(cellIndex * 6 + 3, cellIndex * 6 + 6)];
}

/**
 * Checks that the diagonal of one cell joins the vertices its
 * displacementCellDiagonalRead diagonal names, that both cell triangles share
 * it, and that it is drawn at the lifted surface vertex.
 *
 * @param surfaceMesh Displacement surface mesh.
 * @param grid Grid wireframe of the surface.
 * @param pairs Diagonal vertex index pairs.
 * @param row Cell row.
 * @param column Cell column.
 */
function gridTestCellDiagonalExpect(
  surfaceMesh: THREE.Mesh,
  grid: DisplacementOverlayGrid,
  pairs: readonly number[],
  row: number,
  column: number,
): void {
  const rowLength = displacementOverlayGridRowLengthRead(surfaceMesh.geometry);
  const cellIndex = row * (rowLength - 1) + column;
  const start = pairs[cellIndex * 2] ?? -1;
  const end = pairs[cellIndex * 2 + 1] ?? -1;
  const first = row * rowLength + column;
  const isMain = displacementCellDiagonalRead(row, column) === 'main';
  expect([start, end]).toEqual(isMain ? [first, first + rowLength + 1] : [first + 1, first + rowLength]);
  gridTestCellTrianglesRead(rowLength, cellIndex).forEach((triangle) => {
    expect(triangle).toContain(start);
    expect(triangle).toContain(end);
  });
  const drawnStart = new THREE.Vector3().fromBufferAttribute(
    grid.diagonals.geometry.getAttribute('position'),
    cellIndex * 2,
  );
  expect(drawnStart.distanceTo(gridTestLiftedVertexRead(surfaceMesh.geometry, start))).toBeLessThan(1e-5);
}

/** Hammer-style grid wireframe over a displacement surface. */
describe('DisplacementOverlayGrid', () => {
  it.each(DISPLACEMENT_POWERS.map((power) => [power]))(
    'draws one segment per grid edge and one dashed diagonal per cell at power %i',
    (power) => {
      const surfaceMesh = gridTestSurfaceMeshBuild(power);
      const rowLength = 2 ** power + 1;
      expect(displacementOverlayGridRowLengthRead(surfaceMesh.geometry)).toBe(rowLength);
      const grid = gridTestCreate(surfaceMesh);
      expect(grid.lines.geometry.getAttribute('position').count / 2).toBe(2 * rowLength * (rowLength - 1));
      expect(grid.diagonals.geometry.getAttribute('position').count / 2).toBe((rowLength - 1) ** 2);
      expect(grid.lines.material).toBeInstanceOf(THREE.LineBasicMaterial);
      expect(grid.diagonals.material).toBeInstanceOf(THREE.LineDashedMaterial);
      expect(grid.diagonals.geometry.getAttribute('lineDistance').count).toBe(
        grid.diagonals.geometry.getAttribute('position').count,
      );
      grid.dispose();
    },
  );

  it('places every diagonal on the cell diagonal the surface triangles share', () => {
    const surfaceMesh = gridTestSurfaceMeshBuild(2);
    const rowLength = displacementOverlayGridRowLengthRead(surfaceMesh.geometry);
    const pairs = displacementOverlayGridDiagonalPairsBuild(rowLength);
    const grid = gridTestCreate(surfaceMesh);
    for (let row = 0; row < rowLength - 1; row++) {
      for (let column = 0; column < rowLength - 1; column++) {
        gridTestCellDiagonalExpect(surfaceMesh, grid, pairs, row, column);
      }
    }
    grid.dispose();
  });

  it('joins neighboring grid vertices only, along rows and columns', () => {
    const rowLength = 5;
    const pairs = displacementOverlayGridLinePairsBuild(rowLength);
    for (let entry = 0; entry < pairs.length; entry += 2) {
      const start = pairs[entry] ?? -1;
      const end = pairs[entry + 1] ?? -1;
      const rowStep = Math.floor(end / rowLength) - Math.floor(start / rowLength);
      const columnStep = (end % rowLength) - (start % rowLength);
      expect(Math.abs(rowStep) + Math.abs(columnStep)).toBe(1);
    }
    const segmentKeys = new Set<string>();
    for (let entry = 0; entry < pairs.length; entry += 2) {
      segmentKeys.add(`${pairs[entry]}-${pairs[entry + 1]}`);
    }
    expect(segmentKeys.size).toBe(pairs.length / 2);
  });

  it('floats the grid lines above the surface along the vertex normals', () => {
    const surfaceMesh = gridTestSurfaceMeshBuild(3);
    const pairs = displacementOverlayGridLinePairsBuild(displacementOverlayGridRowLengthRead(surfaceMesh.geometry));
    const grid = gridTestCreate(surfaceMesh);
    const drawn = new THREE.Vector3().fromBufferAttribute(grid.lines.geometry.getAttribute('position'), 0);
    expect(drawn.distanceTo(gridTestLiftedVertexRead(surfaceMesh.geometry, pairs[0] ?? -1))).toBeLessThan(1e-5);
    grid.dispose();
  });

  it('refuses geometries that are no square vertex grid', () => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Array(3 * 7).fill(0), 3));
    expect(DisplacementOverlayGrid.create(geometry, materials)).toBeNull();
  });
});
