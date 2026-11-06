import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { RaycasterFaceSelection } from '@/selection/face/raycaster_face_selection.js';
import { solidFaceTargetFromResultTriangle } from '@/selection/face/solid_face_target_resolver.js';
import { displacementSurfaceCreate } from '@/displacement/model/displacement_face_surface.js';
import { CommandDisplacementEdit } from '@/displacement/commands/command_displacement_edit.js';
import { DisplacementSculptFace } from '@/displacement/sculpt/displacement_sculpt_face.js';
import {
  displacementResultTriangleRead,
  displacementSurfaceMeshesBesideResult,
} from '@/displacement/pick/displacement_pick_mapping.js';
import type { SolidFaceTextureTarget } from '@/texture/commands/command_texture_solid_face_edit.js';
import {
  displacementTestBoxAdd,
  displacementTestFaceFacing,
  displacementTestRigCreate,
  displacementTestSurfaceMeshFind,
  displacementTestTarget,
  type DisplacementTestRig,
} from '../displacement_test_rig.js';
import { displacementPickTestViewCreate } from '../displacement_pick_test_view.js';

/** Elevation lifting the test surface off its flat face. */
const PICK_TEST_ELEVATION = 0.75;

/**
 * Builds a box whose upward face carries an elevated displacement.
 *
 * @returns Rig and displaced face.
 */
function pickTestRigCreate(): { rig: DisplacementTestRig; target: SolidFaceTextureTarget } {
  const rig = displacementTestRigCreate('PickDisplacement');
  const brush = displacementTestBoxAdd(rig, new THREE.Vector3(3, 2, 3), new THREE.Vector3(4, -1, 2));
  const target = displacementTestTarget(rig, brush, displacementTestFaceFacing(brush, new THREE.Vector3(0, 1, 0)));
  const displacement = displacementSurfaceCreate(2, PICK_TEST_ELEVATION);
  rig.commandStack.push(new CommandDisplacementEdit([{ target, displacement }]));
  return { rig, target };
}

/**
 * Returns the world center of the displaced surface of a face.
 *
 * @param target Displaced face.
 * @returns Mean displaced world position.
 */
function pickTestSurfaceCenter(target: SolidFaceTextureTarget): THREE.Vector3 {
  const face = DisplacementSculptFace.fromTarget(target);
  if (!face) throw new Error('face lost its displacement');
  const positions = face.placement.displacedPositions(face.displacement);
  return positions.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / positions.length);
}

/** Picking displaced faces maps hits on the surface back to the brush face. */
describe('displacement pick mapping', () => {
  it('reports a click on the displacement surface as the brush face it replaces', () => {
    const { rig, target } = pickTestRigCreate();
    const surfaceCenter = pickTestSurfaceCenter(target);
    const view = displacementPickTestViewCreate(surfaceCenter, new THREE.Vector3(0, 1, 0), 10);
    const resultMesh = rig.model.getResultMesh();
    const pick = new RaycasterFaceSelection().pickFace(view.event, view.camera, view.pickElement, [resultMesh]);
    expect(pick?.mesh).toBe(resultMesh);
    expect(pick?.hitPoint.distanceTo(surfaceCenter)).toBeLessThan(1e-4);
    const picked = pick ? solidFaceTargetFromResultTriangle(pick.mesh, pick.faceIndex) : null;
    expect(picked?.brushId).toBe(target.brushId);
    expect(picked?.surfaceIndex).toBe(target.surfaceIndex);
  });

  it('maps a surface mesh to a result triangle of its face and lists surfaces only beside result meshes', () => {
    const { rig, target } = pickTestRigCreate();
    const resultMesh = rig.model.getResultMesh();
    const surfaceMesh = displacementTestSurfaceMeshFind(rig, target);
    if (!surfaceMesh) throw new Error('surface mesh missing');
    expect(displacementSurfaceMeshesBesideResult(resultMesh)).toEqual([surfaceMesh]);
    expect(displacementSurfaceMeshesBesideResult(surfaceMesh)).toEqual([]);
    const triangle = displacementResultTriangleRead(resultMesh, surfaceMesh);
    const mapped = solidFaceTargetFromResultTriangle(resultMesh, triangle);
    expect(mapped?.surfaceIndex).toBe(target.surfaceIndex);
    expect(displacementResultTriangleRead(resultMesh, resultMesh)).toBe(-1);
  });
});
