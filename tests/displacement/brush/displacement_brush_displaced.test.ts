import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { displacementBrushDisplacedIs } from '@/displacement/brush/displacement_brush_displaced.js';
import {
  displacementTestBoxAdd,
  displacementTestCreate,
  displacementTestFaceFacing,
  displacementTestRigCreate,
  displacementTestTarget,
} from '../displacement_test_rig.js';

/** The shared rule deciding a brush is represented only by displacements. */
describe('displacementBrushDisplacedIs', () => {
  it('is false for a flat brush, true once one face is displaced and false again after undo', () => {
    const rig = displacementTestRigCreate('BrushDisplaced');
    const brush = displacementTestBoxAdd(rig, new THREE.Vector3(2, 1, 2), new THREE.Vector3(0, 0, 0));
    expect(displacementBrushDisplacedIs(brush)).toBe(false);
    const side = displacementTestFaceFacing(brush, new THREE.Vector3(1, 0, 0));
    displacementTestCreate(rig, displacementTestTarget(rig, brush, side), 2);
    expect(displacementBrushDisplacedIs(brush)).toBe(true);
    expect(rig.commandStack.undo()).toBe(true);
    expect(displacementBrushDisplacedIs(brush)).toBe(false);
  });
});
