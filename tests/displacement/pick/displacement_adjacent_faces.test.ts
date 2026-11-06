import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SolidModel } from '@/solid/model/solid_model.js';
import type { SolidFaceTextureTarget } from '@/texture/commands/command_texture_solid_face_edit.js';
import { DisplacementAdjacentFaces } from '@/displacement/pick/displacement_adjacent_faces.js';
import { ControllerDisplacementActions } from '@/displacement/controller/controller_displacement_actions.js';
import {
  displacementTestBoxAdd,
  displacementTestCreate,
  displacementTestFaceFacing,
  displacementTestRigCreate,
  displacementTestTarget,
  type DisplacementTestRig,
} from '../displacement_test_rig.js';

/** Edge lengths of every box the adjacency tests build. */
const ADJACENT_TEST_BOX_EDGES = new THREE.Vector3(2, 1, 2);

/** Faces built by the adjacency rig. */
interface AdjacentTestScene {
  rig: DisplacementTestRig;
  selected: SolidFaceTextureTarget;
  neighbour: SolidFaceTextureTarget;
  distant: SolidFaceTextureTarget;
  flatNeighbour: SolidFaceTextureTarget;
}

/**
 * Adds a box to a rig's model or to another model, and returns its top face.
 *
 * @param rig Test rig.
 * @param model Model receiving the box.
 * @param center World center of the box.
 * @returns Top face target.
 */
function adjacentTestTopFaceAdd(
  rig: DisplacementTestRig,
  model: SolidModel,
  center: THREE.Vector3,
): SolidFaceTextureTarget {
  const modelRig = { ...rig, model };
  const brush = displacementTestBoxAdd(modelRig, ADJACENT_TEST_BOX_EDGES, center);
  return displacementTestTarget(modelRig, brush, displacementTestFaceFacing(brush, new THREE.Vector3(0, 1, 0)));
}

/**
 * Builds a displaced top face, a displaced neighbour in another solid model
 * sharing its edge, a distant displaced face and a flat touching face.
 *
 * @returns Built faces.
 */
function adjacentTestSceneCreate(): AdjacentTestScene {
  const rig = displacementTestRigCreate('AdjacentFirst');
  const otherModel = new SolidModel('AdjacentSecond');
  rig.world.add(otherModel.root);
  const origin = new THREE.Vector3(1, 2, -3);
  const step = new THREE.Vector3(ADJACENT_TEST_BOX_EDGES.x, 0, 0);
  const selected = adjacentTestTopFaceAdd(rig, rig.model, origin);
  const neighbour = adjacentTestTopFaceAdd(rig, otherModel, origin.clone().add(step));
  const distant = adjacentTestTopFaceAdd(rig, rig.model, origin.clone().addScaledVector(step, 5));
  const flatNeighbour = adjacentTestTopFaceAdd(rig, rig.model, origin.clone().sub(step));
  [selected, neighbour, distant].forEach((target) => displacementTestCreate(rig, target, 2));
  return { rig, selected, neighbour, distant, flatNeighbour };
}

/** Select Adjacent finding of displaced neighbour faces. */
describe('DisplacementAdjacentFaces', () => {
  it('finds the displaced face sharing an edge, even in another model, and not a distant or flat one', () => {
    const scene = adjacentTestSceneCreate();
    const adjacent = DisplacementAdjacentFaces.adjacentTargetsFind([scene.selected]);
    expect(adjacent).toHaveLength(1);
    expect(adjacent[0]).toMatchObject({ brushId: scene.neighbour.brushId, surfaceIndex: scene.neighbour.surfaceIndex });
    expect(adjacent[0]?.model).toBe(scene.neighbour.model);
  });

  it('finds nothing for flat selections and leaves already selected faces out', () => {
    const scene = adjacentTestSceneCreate();
    expect(DisplacementAdjacentFaces.adjacentTargetsFind([scene.flatNeighbour])).toEqual([]);
    expect(DisplacementAdjacentFaces.adjacentTargetsFind([scene.selected, scene.neighbour])).toEqual([]);
  });

  it('adds the neighbour to the face selection through the actions controller', () => {
    const scene = adjacentTestSceneCreate();
    const selection: SolidFaceTextureTarget[] = [scene.selected];
    const actions = new ControllerDisplacementActions(
      scene.rig.commandStack,
      () => selection.slice(),
      (targets, addToSelection) => selection.splice(addToSelection ? selection.length : 0, Infinity, ...targets),
    );
    const undoCountBefore = scene.rig.commandStack.getUndoCount();
    const result = actions.selectAdjacent();
    expect(result.ok).toBe(true);
    expect(selection.map((target) => target.brushId)).toEqual([scene.selected.brushId, scene.neighbour.brushId]);
    expect(scene.rig.commandStack.getUndoCount()).toBe(undoCountBefore);
    expect(actions.selectAdjacent().ok).toBe(false);
    expect(new ControllerDisplacementActions(scene.rig.commandStack, () => selection).selectAdjacent().ok).toBe(false);
  });
});
