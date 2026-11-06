import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  solidFaceSelectionSeedsFromTargets,
  solidFaceTargetsFromSelections,
} from '@/selection/face/solid_face_target_resolver.js';
import {
  displacementTestBoxAdd,
  displacementTestFaceFacing,
  displacementTestRigCreate,
  displacementTestTarget,
} from '../../displacement/displacement_test_rig.js';

/** Mapping between brush face targets and face selection seeds. */
describe('solid face target resolver', () => {
  it('maps brush face targets to result mesh seeds that map back to the same targets', () => {
    const rig = displacementTestRigCreate('TargetResolverRoundTrip');
    const brush = displacementTestBoxAdd(rig, new THREE.Vector3(2, 3, 1), new THREE.Vector3(-1, 2, 4));
    const targets = [new THREE.Vector3(0, 1, 0), new THREE.Vector3(-1, 0, 0)].map((direction) =>
      displacementTestTarget(rig, brush, displacementTestFaceFacing(brush, direction)),
    );
    const seeds = solidFaceSelectionSeedsFromTargets(targets);
    expect(seeds).toHaveLength(targets.length);
    seeds.forEach((seed) => expect(seed.mesh).toBe(rig.model.getResultMesh()));
    expect(solidFaceTargetsFromSelections(seeds)).toEqual(targets);
  });

  it('skips targets whose face has no result triangle', () => {
    const rig = displacementTestRigCreate('TargetResolverMissing');
    const brush = displacementTestBoxAdd(rig, new THREE.Vector3(1, 1, 1), new THREE.Vector3(0, 0, 0));
    const missing = displacementTestTarget(rig, brush, brush.brush.faces.length + 1);
    expect(solidFaceSelectionSeedsFromTargets([missing])).toEqual([]);
  });
});
