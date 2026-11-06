import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SolidBrushFactory } from '@/solid/brush/solid_brush_factory.js';
import type { SolidBrush } from '@/solid/brush/solid_brush.js';
import { DISPLACEMENT_POWERS } from '@/displacement/model/displacement_types.js';
import { displacementRowLength } from '@/displacement/model/displacement_face_surface.js';
import { DisplacementGrid } from '@/displacement/grid/displacement_grid.js';

/**
 * Builds a tetrahedron brush whose faces all have three sides.
 *
 * @returns Tetrahedron brush.
 */
function gridTestTetrahedronCreate(): SolidBrush {
  const origin = new THREE.Vector3(0, 0, 0);
  const alongX = new THREE.Vector3(1, 0, 0);
  const alongY = new THREE.Vector3(0, 1, 0);
  const alongZ = new THREE.Vector3(0, 0, 1);
  const brush = SolidBrushFactory.createFromFaceLoops([
    [origin, alongY, alongX],
    [origin, alongX, alongZ],
    [origin, alongZ, alongY],
    [alongX, alongY, alongZ],
  ]);
  if (!brush) throw new Error('tetrahedron could not be built');
  return brush;
}

/** Flat displacement grids over brush faces. */
describe('DisplacementGrid', () => {
  it('spans every box face with a coplanar evenly spaced grid whose corners are the face corners', () => {
    const brush = SolidBrushFactory.createCenteredBox(3, 2, 5);
    for (const power of DISPLACEMENT_POWERS) {
      brush.faces.forEach((face, faceIndex) => {
        const grid = DisplacementGrid.fromBrushFace(brush, faceIndex, power);
        if (!grid) throw new Error('box face rejected');
        const points = grid.basePointsLocal();
        const rowLength = displacementRowLength(power);
        expect(points).toHaveLength(grid.vertexCount());
        const corners = brush.getFaceVertices(face);
        [0, rowLength - 1, rowLength * rowLength - 1, rowLength * (rowLength - 1)].forEach(
          (pointIndex, cornerIndex) => {
            expect(points[pointIndex]?.distanceTo(corners[cornerIndex] ?? new THREE.Vector3(NaN))).toBeLessThan(1e-9);
          },
        );
        const plane = new THREE.Plane().setFromCoplanarPoints(
          corners[0] ?? new THREE.Vector3(),
          corners[1] ?? new THREE.Vector3(),
          corners[2] ?? new THREE.Vector3(),
        );
        points.forEach((point) => expect(Math.abs(plane.distanceToPoint(point))).toBeLessThan(1e-9));
        const firstStep = (points[1] ?? new THREE.Vector3()).distanceTo(points[0] ?? new THREE.Vector3());
        expect(
          (points[rowLength - 1] ?? new THREE.Vector3()).distanceTo(points[rowLength - 2] ?? new THREE.Vector3()),
        ).toBeCloseTo(firstStep, 9);
      });
    }
  });

  it('refuses faces that do not have four sides and faces that do not exist', () => {
    const brush = gridTestTetrahedronCreate();
    brush.faces.forEach((_face, faceIndex) => {
      expect(DisplacementGrid.fromBrushFace(brush, faceIndex, 2)).toBeNull();
      expect(DisplacementGrid.faceFailureRead(brush, faceIndex)).toContain('four-sided');
    });
    expect(DisplacementGrid.faceFailureRead(brush, brush.faces.length)).toContain('does not exist');
  });
});
