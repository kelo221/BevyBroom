import { expect } from 'vitest';
import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { displacementVertexOnBorderIs } from '@/displacement/grid/displacement_grid_neighborhood.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import type { SolidFaceTextureTarget } from '@/texture/commands/command_texture_solid_face_edit.js';
import type { DisplacementFaceSurface, DisplacementPower } from '@/displacement/model/displacement_types.js';
import { displacementSurfaceCreate } from '@/displacement/model/displacement_face_surface.js';
import { CommandDisplacementEdit } from '@/displacement/commands/command_displacement_edit.js';
import { displacementSurfaceMeshFind } from '@/displacement/mesh/displacement_surface_mesh_keys.js';
import { StateDisplacementSculpt } from '@/displacement/state/state_displacement_sculpt.js';
import {
  displacementSculptStrokeSettingsFromShared,
  type DisplacementSculptStrokeSettings,
} from '@/displacement/sculpt/displacement_sculpt_stroke_settings.js';
import { DisplacementSculptFace } from '@/displacement/sculpt/displacement_sculpt_face.js';
import { solidBrushToolsTestBoxAdd } from '../tools/csg/solid/solid_brush_tools_test_helpers.js';

/** World, model and undo stack shared by displacement tests. */
export interface DisplacementTestRig {
  /** Scene root holding the solid model. */
  world: THREE.Group;
  /** Solid model receiving brushes. */
  model: SolidModel;
  /** Undo stack displacement edits are pushed on. */
  commandStack: CommandStack;
}

/**
 * Creates an empty solid model inside a world group.
 *
 * @param name Model name.
 * @returns Rig with world, model and undo stack.
 */
export function displacementTestRigCreate(name: string): DisplacementTestRig {
  const world = new THREE.Group();
  const model = new SolidModel(name);
  world.add(model.root);
  return { world, model, commandStack: new CommandStack(100) };
}

/**
 * Adds a box brush and rebuilds the model so its result mesh exists.
 *
 * @param rig Test rig.
 * @param edges Edge lengths along X, Y and Z.
 * @param center World center of the box.
 * @returns Created brush.
 */
export function displacementTestBoxAdd(
  rig: DisplacementTestRig,
  edges: THREE.Vector3,
  center: THREE.Vector3,
): SolidBrushInstance {
  const brush = solidBrushToolsTestBoxAdd(rig.model, edges, center);
  rig.model.rebuild(true);
  return brush;
}

/**
 * Finds the brush face whose outward normal points closest to a direction.
 *
 * @param brush Brush to search.
 * @param direction Wanted outward direction in brush space.
 * @returns Face index.
 */
export function displacementTestFaceFacing(brush: SolidBrushInstance, direction: THREE.Vector3): number {
  let bestIndex = 0;
  let bestDot = -Infinity;
  brush.brush.faces.forEach((_face, faceIndex) => {
    const dot = brush.faceNormalLocal(faceIndex).dot(direction);
    if (dot > bestDot) {
      bestDot = dot;
      bestIndex = faceIndex;
    }
  });
  return bestIndex;
}

/**
 * Builds the edit target of one brush face.
 *
 * @param rig Test rig.
 * @param brush Brush owning the face.
 * @param surfaceIndex Face index.
 * @returns Face target.
 */
export function displacementTestTarget(
  rig: DisplacementTestRig,
  brush: SolidBrushInstance,
  surfaceIndex: number,
): SolidFaceTextureTarget {
  return { model: rig.model, brushId: brush.id, surfaceIndex };
}

/**
 * Gives one brush face a flat displacement through the undo stack.
 *
 * @param rig Test rig.
 * @param target Face to displace.
 * @param power Subdivision power.
 */
export function displacementTestCreate(
  rig: DisplacementTestRig,
  target: SolidFaceTextureTarget,
  power: DisplacementPower,
): void {
  rig.commandStack.push(new CommandDisplacementEdit([{ target, displacement: displacementSurfaceCreate(power) }]));
}

/**
 * Finds the displacement surface mesh of one brush face.
 *
 * @param rig Test rig.
 * @param target Displaced face.
 * @returns Surface mesh, or undefined when the face shows none.
 */
export function displacementTestSurfaceMeshFind(
  rig: DisplacementTestRig,
  target: SolidFaceTextureTarget,
): THREE.Mesh | undefined {
  return displacementSurfaceMeshFind(rig.model.root, target.brushId, target.surfaceIndex) ?? undefined;
}

/**
 * Returns the stored offsets of a displaced face.
 *
 * @param target Displaced face.
 * @returns Copy of the offsets, empty when the face has no displacement.
 */
export function displacementTestOffsetsRead(target: SolidFaceTextureTarget): number[] {
  return target.model.findBrush(target.brushId)?.faceDisplacementRead(target.surfaceIndex)?.offsets.slice() ?? [];
}

/**
 * Builds stroke settings from the default Displacement tab settings with some
 * fields replaced.
 *
 * @param overrides Stroke settings to replace.
 * @returns Raising stroke settings with seed 1 and the overrides applied.
 */
export function displacementTestStrokeSettings(
  overrides: Partial<DisplacementSculptStrokeSettings>,
): DisplacementSculptStrokeSettings {
  const defaults = displacementSculptStrokeSettingsFromShared(new StateDisplacementSculpt().settingsRead(), 1, 1);
  return { ...defaults, ...overrides };
}

/**
 * Returns the stored alphas of a displaced face.
 *
 * @param target Displaced face.
 * @returns Copy of the alphas, empty when the face has no displacement.
 */
export function displacementTestAlphasRead(target: SolidFaceTextureTarget): number[] {
  return target.model.findBrush(target.brushId)?.faceDisplacementRead(target.surfaceIndex)?.alphas.slice() ?? [];
}

/**
 * Stores a displacement on a face through the undo stack.
 *
 * @param rig Test rig.
 * @param target Face.
 * @param displacement Displacement to store.
 */
export function displacementTestStore(
  rig: DisplacementTestRig,
  target: SolidFaceTextureTarget,
  displacement: DisplacementFaceSurface,
): void {
  rig.commandStack.push(new CommandDisplacementEdit([{ target, displacement }]));
}

/**
 * Returns the world displaced positions of a face.
 *
 * @param target Displaced face.
 * @returns Row-major world positions.
 */
export function displacementTestWorldPositions(target: SolidFaceTextureTarget): THREE.Vector3[] {
  const face = DisplacementSculptFace.fromTarget(target);
  if (!face) throw new Error('face has no displacement');
  return face.placement.displacedPositions(face.displacement);
}

/**
 * Checks that the two faces share a full border edge and that every vertex on
 * it sits at the same displaced position as its partner on the other face.
 *
 * @param targets The two sewn faces.
 */
export function displacementTestSharedEdgeExpectSewn(targets: readonly SolidFaceTextureTarget[]): void {
  const [first, second] = targets.map((target) => DisplacementSculptFace.fromTarget(target));
  if (!first || !second) throw new Error('sewn faces lost their displacement');
  const secondPositions = second.placement.displacedPositions(second.displacement);
  let matchedCount = 0;
  first.placement.basePositions.forEach((base, vertexIndex) => {
    if (!displacementVertexOnBorderIs(first.rowLength(), vertexIndex)) return;
    const partnerIndex = second.placement.basePositions.findIndex((other) => other.distanceTo(base) < 1e-4);
    const partner = secondPositions[partnerIndex];
    if (!partner) return;
    const position = first.placement.displacedPositionWrite(first.displacement, vertexIndex, new THREE.Vector3());
    expect(position.distanceTo(partner)).toBeLessThan(1e-5);
    matchedCount += 1;
  });
  expect(matchedCount).toBe(first.rowLength());
}

/**
 * Returns the world center of the flat grid of a displaced face.
 *
 * @param target Displaced face.
 * @returns World-space center.
 */
export function displacementTestFaceCenter(target: SolidFaceTextureTarget): THREE.Vector3 {
  const face = DisplacementSculptFace.fromTarget(target);
  if (!face) throw new Error('face has no displacement');
  const sum = face.placement.basePositions.reduce((total, point) => total.add(point), new THREE.Vector3());
  return sum.multiplyScalar(1 / face.placement.basePositions.length);
}
