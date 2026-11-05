import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SolidOperation } from '@/solid/types/solid_operation.js';
import { DISPLACEMENT_ALPHA_MAX, type DisplacementFaceSurface } from '@/displacement/model/displacement_types.js';
import { displacementVertexCount } from '@/displacement/model/displacement_face_surface.js';
import { ControllerDisplacementActions } from '@/displacement/controller/controller_displacement_actions.js';
import type { SolidFaceTextureTarget } from '@/texture/commands/command_texture_solid_face_edit.js';
import {
  displacementTestBoxAdd,
  displacementTestFaceFacing,
  displacementTestRigCreate,
  displacementTestTarget,
  type DisplacementTestRig,
} from '../displacement_test_rig.js';

/** Edge lengths of the neighboring test boxes. */
const ACTIONS_TEST_BOX_EDGES = new THREE.Vector3(2, 1, 2);

/**
 * Builds two neighboring boxes and actions acting on both upward faces.
 *
 * @returns Rig, the two top faces and the actions.
 */
function actionsTestRigCreate(): {
  rig: DisplacementTestRig;
  targets: SolidFaceTextureTarget[];
  actions: ControllerDisplacementActions;
} {
  const rig = displacementTestRigCreate('ActionsTest');
  const firstCenter = new THREE.Vector3(1, 0, -1);
  const brushes = [firstCenter, firstCenter.clone().add(new THREE.Vector3(0, 0, ACTIONS_TEST_BOX_EDGES.z))].map(
    (center) => displacementTestBoxAdd(rig, ACTIONS_TEST_BOX_EDGES, center),
  );
  const up = new THREE.Vector3(0, 1, 0);
  const targets = brushes.map((brush) => displacementTestTarget(rig, brush, displacementTestFaceFacing(brush, up)));
  return { rig, targets, actions: new ControllerDisplacementActions(rig.commandStack, () => targets) };
}

/**
 * Reads the stored displacement of a face or fails the test.
 *
 * @param target Face.
 * @returns Stored displacement.
 */
function actionsTestDisplacementRead(target: SolidFaceTextureTarget): DisplacementFaceSurface {
  const displacement = target.model.findBrush(target.brushId)?.faceDisplacementRead(target.surfaceIndex);
  if (!displacement) throw new Error('face has no displacement');
  return displacement;
}

/** Displacement tab actions over the face selection. */
describe('ControllerDisplacementActions', () => {
  it('creates, subdivides, inverts alpha, sets elevation and scale, each as one undo step', () => {
    const { rig, targets, actions } = actionsTestRigCreate();
    expect(actions.destroy().ok).toBe(false);
    expect(actions.create(2).editedFaceCount).toBe(2);
    expect(actions.subdivide().ok).toBe(true);
    expect(actions.invertAlpha().ok).toBe(true);
    expect(actions.elevationSet(0.4).ok).toBe(true);
    expect(actions.scaleSet(2).ok).toBe(true);
    expect(rig.commandStack.getUndoCount()).toBe(5);
    targets.forEach((target) => {
      const displacement = actionsTestDisplacementRead(target);
      expect(displacement.offsets).toHaveLength(displacementVertexCount(3));
      expect(displacement.alphas.every((alpha) => alpha === DISPLACEMENT_ALPHA_MAX)).toBe(true);
      expect(displacement.elevation).toBe(0.4);
      expect(displacement.scale).toBe(2);
    });
    rig.commandStack.undo();
    expect(actionsTestDisplacementRead(targets[0] as SolidFaceTextureTarget).scale).toBe(1);
  });

  it('adds noise, smooths and sews the shared edge of neighboring faces', () => {
    const { targets, actions } = actionsTestRigCreate();
    actions.create(2);
    expect(actions.noise(-0.5, 0.5, 3).ok).toBe(true);
    const noisy = targets.map((target) => actionsTestDisplacementRead(target).offsets.slice());
    expect(noisy[0]?.some((offset) => offset !== 0)).toBe(true);
    expect(actions.smooth().ok).toBe(true);
    expect(actionsTestDisplacementRead(targets[0] as SolidFaceTextureTarget).offsets).not.toEqual(noisy[0]);
    expect(actions.sew().editedFaceCount).toBe(2);
    expect(actions.sew().ok).toBe(false);
  });

  it('destroys displacements and refuses faces of subtractive brushes', () => {
    const { rig, targets, actions } = actionsTestRigCreate();
    actions.create(3);
    expect(actions.destroy().editedFaceCount).toBe(2);
    targets.forEach((target) => {
      expect(target.model.findBrush(target.brushId)?.faceDisplacementRead(target.surfaceIndex)).toBeUndefined();
    });
    const carve = rig.model.addBoxBrush(1, SolidOperation.Subtractive, rig.model.root, false);
    const carveTarget = displacementTestTarget(rig, carve, 0);
    const carveActions = new ControllerDisplacementActions(rig.commandStack, () => [carveTarget]);
    const refused = carveActions.create(2);
    expect(refused.ok).toBe(false);
    expect(refused.message).toContain('additive');
  });
});
