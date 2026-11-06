import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  DisplacementSurfaceRaycaster,
  displacementSurfaceMeshesOfTargets,
} from '@/displacement/sculpt/displacement_surface_raycaster.js';
import { DisplacementSculptFace } from '@/displacement/sculpt/displacement_sculpt_face.js';
import type { SolidFaceTextureTarget } from '@/texture/commands/command_texture_solid_face_edit.js';
import {
  displacementTestBoxAdd,
  displacementTestCreate,
  displacementTestFaceFacing,
  displacementTestRigCreate,
  displacementTestSurfaceMeshFind,
  displacementTestTarget,
} from '../displacement_test_rig.js';
import { displacementPickTestViewCreate } from '../displacement_pick_test_view.js';

const raycasters: DisplacementSurfaceRaycaster[] = [];

/**
 * Returns the world center of the flat grid of a displaced face.
 *
 * @param target Displaced face.
 * @returns World-space center.
 */
function raycasterTestFaceCenter(target: SolidFaceTextureTarget): THREE.Vector3 {
  const face = DisplacementSculptFace.fromTarget(target);
  if (!face) throw new Error('face has no displacement');
  const sum = face.placement.basePositions.reduce((total, point) => total.add(point), new THREE.Vector3());
  return sum.multiplyScalar(1 / face.placement.basePositions.length);
}

/** Pointer raycasts against displacement surfaces of brush faces. */
describe('DisplacementSurfaceRaycaster', () => {
  afterEach(() => {
    raycasters.splice(0).forEach((raycaster) => raycaster.dispose());
  });

  it('returns the hit point and the outward surface normal of a displaced face', () => {
    const rig = displacementTestRigCreate('SurfaceRaycaster');
    const brush = displacementTestBoxAdd(rig, new THREE.Vector3(3, 3, 3), new THREE.Vector3(1, 4, -6));
    const outward = new THREE.Vector3(-1, 0, 0);
    const target = displacementTestTarget(rig, brush, displacementTestFaceFacing(brush, outward));
    const flatTarget = displacementTestTarget(
      rig,
      brush,
      displacementTestFaceFacing(brush, new THREE.Vector3(0, 1, 0)),
    );
    displacementTestCreate(rig, target, 2);
    expect(displacementSurfaceMeshesOfTargets([target, flatTarget])).toEqual([
      displacementTestSurfaceMeshFind(rig, target),
    ]);
    const view = displacementPickTestViewCreate(raycasterTestFaceCenter(target), outward, 6);
    const raycaster = new DisplacementSurfaceRaycaster();
    raycasters.push(raycaster);
    const hit = raycaster.hitRead(view.event, view.camera, view.pickElement, [target]);
    expect(hit).not.toBeNull();
    expect(hit?.point.distanceTo(raycasterTestFaceCenter(target))).toBeLessThan(1e-3);
    expect(hit?.normal.dot(outward)).toBeCloseTo(1, 6);
    expect(raycaster.hitRead(view.event, view.camera, view.pickElement, [flatTarget])).toBeNull();
  });
});
