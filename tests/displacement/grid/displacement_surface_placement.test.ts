import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { DisplacementFaceSurface } from '@/displacement/model/displacement_types.js';
import { displacementSurfaceCreate } from '@/displacement/model/displacement_face_surface.js';
import { displacementSeamOffsetWrite } from '@/displacement/model/displacement_seam_offsets.js';
import { DisplacementSculptOps } from '@/displacement/sculpt/displacement_sculpt_ops.js';
import { DisplacementSurfacePlacement } from '@/displacement/grid/displacement_surface_placement.js';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import {
  displacementTestBoxAdd,
  displacementTestFaceFacing,
  displacementTestRigCreate,
  type DisplacementTestRig,
} from '../displacement_test_rig.js';

/** Edge lengths of the placement test box. */
const PLACEMENT_TEST_BOX_EDGES = new THREE.Vector3(3, 2, 5);

/**
 * Builds a rig with one rotated, non-uniformly scaled box inside a moved solid
 * model root.
 *
 * @returns Rig and the box.
 */
function placementTestBrushCreate(): { rig: DisplacementTestRig; brush: SolidBrushInstance } {
  const rig = displacementTestRigCreate('PlacementTest');
  rig.model.root.position.set(2, -1, 3);
  rig.model.root.rotation.set(0.2, -0.4, 0.1);
  const brush = displacementTestBoxAdd(rig, PLACEMENT_TEST_BOX_EDGES, new THREE.Vector3(-1, 2, 1));
  brush.rotation.set(0.61, -0.33, 0.47);
  brush.scale.set(1.3, 0.7, 1.9);
  brush.pushTransformToMesh();
  rig.model.rebuild(true);
  return { rig, brush };
}

/**
 * Places the +X face of a brush in world space with a noisy displacement.
 *
 * @param rig Test rig.
 * @param brush Brush owning the face.
 * @returns Placement and displacement.
 */
function placementTestWorldPlace(
  rig: DisplacementTestRig,
  brush: SolidBrushInstance,
): { placement: DisplacementSurfacePlacement; displacement: DisplacementFaceSurface; surfaceIndex: number } {
  const surfaceIndex = displacementTestFaceFacing(brush, new THREE.Vector3(1, 0, 0));
  const displacement = displacementSurfaceCreate(3, 0.2);
  DisplacementSculptOps.applyNoise(displacement, -0.3, 0.3, 3);
  const placement = DisplacementSurfacePlacement.forWorldSpace(brush, surfaceIndex, displacement, rig.model.root);
  if (!placement) throw new Error('box face rejected');
  return { placement, displacement, surfaceIndex };
}

/**
 * Returns the placed edge from the first face corner to the corner at a grid
 * vertex.
 *
 * @param placement Placed grid.
 * @param cornerVertexIndex Row-major index of the corner vertex.
 * @returns Edge vector in the placement's space.
 */
function placementTestEdgeRead(placement: DisplacementSurfacePlacement, cornerVertexIndex: number): THREE.Vector3 {
  const first = placement.basePositions[0];
  const corner = placement.basePositions[cornerVertexIndex];
  if (!first || !corner) throw new Error('grid corner missing');
  return corner.clone().sub(first);
}

/** Placing displaced vertices with their seam offsets. */
describe('DisplacementSurfacePlacement seam offsets', () => {
  it('adds the seam offset through the placed face edges and normal to the displaced position', () => {
    const { rig, brush } = placementTestBrushCreate();
    const { placement, displacement } = placementTestWorldPlace(rig, brush);
    const rowLength = placement.rowLength;
    const firstEdge = placementTestEdgeRead(placement, rowLength - 1);
    const fourthEdge = placementTestEdgeRead(placement, rowLength * (rowLength - 1));
    const seamOffset = new THREE.Vector3(0.13, -0.21, 0.4);
    const vertexIndex = rowLength + 2;
    expect(displacementSeamOffsetWrite(displacement, vertexIndex, seamOffset)).toBe(true);
    const expected = placement
      .heightPositionWrite(displacement, vertexIndex, new THREE.Vector3())
      .addScaledVector(firstEdge, seamOffset.x)
      .addScaledVector(fourthEdge, seamOffset.y)
      .addScaledVector(placement.normal, seamOffset.z);
    const displaced = placement.displacedPositionWrite(displacement, vertexIndex, new THREE.Vector3());
    expect(displaced.distanceTo(expected)).toBeLessThan(1e-9);
    const untouched = placement.displacedPositionWrite(displacement, vertexIndex + 1, new THREE.Vector3());
    expect(
      untouched.distanceTo(placement.heightPositionWrite(displacement, vertexIndex + 1, new THREE.Vector3())),
    ).toBe(0);
  });

  it('converts space vectors to seam offsets and back through a rotated and scaled matrix', () => {
    const { rig, brush } = placementTestBrushCreate();
    const { placement } = placementTestWorldPlace(rig, brush);
    const rowLength = placement.rowLength;
    const inPlane = placementTestEdgeRead(placement, rowLength - 1)
      .multiplyScalar(0.37)
      .addScaledVector(placementTestEdgeRead(placement, rowLength * (rowLength - 1)), -0.18);
    const inPlaneSeam = placement.seamOffsetFromSpaceWrite(inPlane.clone());
    expect(inPlaneSeam.x).toBeCloseTo(0.37, 9);
    expect(inPlaneSeam.y).toBeCloseTo(-0.18, 9);
    expect(inPlaneSeam.z).toBeCloseTo(0, 9);
    const anyVector = new THREE.Vector3(0.7, -1.1, 0.4);
    const roundTrip = placement.seamOffsetToSpaceWrite(placement.seamOffsetFromSpaceWrite(anyVector.clone()));
    expect(roundTrip.distanceTo(anyVector)).toBeLessThan(1e-9);
  });

  it('places seam offsets identically in model space and world space', () => {
    const { rig, brush } = placementTestBrushCreate();
    const { placement, displacement, surfaceIndex } = placementTestWorldPlace(rig, brush);
    displacement.offsets.forEach((_offset, vertexIndex) => {
      displacementSeamOffsetWrite(displacement, vertexIndex, new THREE.Vector3(0.01 * vertexIndex, -0.02, 0));
    });
    const modelPlacement = DisplacementSurfacePlacement.forModelSpace(brush, surfaceIndex, displacement);
    if (!modelPlacement) throw new Error('box face rejected');
    rig.model.root.updateWorldMatrix(true, false);
    const worldPositions = placement.displacedPositions(displacement);
    modelPlacement.displacedPositions(displacement).forEach((modelPosition, vertexIndex) => {
      const placed = modelPosition.applyMatrix4(rig.model.root.matrixWorld);
      expect(placed.distanceTo(worldPositions[vertexIndex] ?? new THREE.Vector3(Number.NaN))).toBeLessThan(1e-9);
    });
  });
});
