import * as THREE from 'three';
import { SolidBrushFactory } from '@/solid/brush/solid_brush_factory.js';
import type { SolidBrush } from '@/solid/brush/solid_brush.js';
import { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import type { ModifierStackUnit, ModifierStackVolumeOperation } from '@/modifier/stack/modifier_stack_types.js';
import {
  modifierStackVolumeOperationIsBoolean,
  modifierStackVolumeOperationSolidOf,
  type ModifierStackBooleanVolumeOperation,
} from '@/modifier/stack/modifier_stack_volume_operation.js';
import { modifierStackDerivedMesh, modifierStackReverseWinding } from './modifier_stack_copy.js';
import { modifierStackFrame, modifierStackModelPlacement, modifierStackVolumeBox } from './modifier_stack_frame.js';

/**
 * Appends the volume's own box as a derived unit when the volume has a boolean
 * operation; otherwise returns the units unchanged.
 *
 * @param units Working set produced by the volume's stack.
 * @param volume Modifier volume.
 * @param operation Volume operation.
 * @param solidRoot Authored solid model root.
 * @returns Working set with the box unit appended when it applies.
 */
export function modifierStackOperationBoxAppend(
  units: ModifierStackUnit[],
  volume: THREE.Object3D,
  operation: ModifierStackVolumeOperation,
  solidRoot: THREE.Object3D,
): ModifierStackUnit[] {
  if (!modifierStackVolumeOperationIsBoolean(operation)) return units;
  const unit = modifierStackOperationBoxUnit(volume, operation, solidRoot);
  return unit ? [...units, unit] : units;
}

/**
 * Builds the derived unit that holds the volume's box, in model space.
 *
 * @param volume Modifier volume.
 * @param operation Boolean volume operation.
 * @param solidRoot Authored solid model root.
 * @returns Derived unit, or null when the volume has no box.
 */
function modifierStackOperationBoxUnit(
  volume: THREE.Object3D,
  operation: ModifierStackBooleanVolumeOperation,
  solidRoot: THREE.Object3D,
): ModifierStackUnit | null {
  const box = modifierStackVolumeBox(volume);
  if (modifierStackOperationBoxIsDegenerate(box)) return null;
  const matrix = modifierStackModelPlacement(modifierStackFrame(volume, 'volume'), solidRoot);
  const brush = modifierStackOperationBoxBrush(box.min, box.max, matrix);
  const id = `${volume.uuid}#operation`;
  const instance = new SolidBrushInstance(id, volume.name, brush, modifierStackVolumeOperationSolidOf(operation));
  instance.mesh = modifierStackDerivedMesh(id, null);
  return { tree: instance.mesh, brushes: [instance], authored: false, origin: null };
}

/**
 * Returns whether a volume box has no volume: empty, or flat on any axis.
 *
 * @param box Volume box in its frame.
 * @returns True when the box cannot enclose a solid.
 */
function modifierStackOperationBoxIsDegenerate(box: THREE.Box3): boolean {
  return box.isEmpty() || modifierStackOperationBoxFlatAxis(box) !== null;
}

/**
 * Names the first axis on which a non-empty volume box has no thickness.
 *
 * @param box Volume box in its frame.
 * @returns 'X', 'Y' or 'Z', or null when the box is empty or has thickness on
 *   every axis.
 */
export function modifierStackOperationBoxFlatAxis(box: THREE.Box3): 'X' | 'Y' | 'Z' | null {
  if (box.isEmpty()) return null;
  const size = box.getSize(new THREE.Vector3());
  if (size.x <= 0) return 'X';
  if (size.y <= 0) return 'Y';
  return size.z <= 0 ? 'Z' : null;
}

/**
 * Creates the box brush in model space, reversing its winding when the matrix
 * mirrors (a mirrored solid root), so its faces stay outward.
 *
 * @param min Box minimum in the volume frame.
 * @param max Box maximum in the volume frame.
 * @param matrix Volume-frame to model matrix.
 * @returns Convex box brush in model space.
 */
function modifierStackOperationBoxBrush(min: THREE.Vector3, max: THREE.Vector3, matrix: THREE.Matrix4): SolidBrush {
  const brush = SolidBrushFactory.createBox(min, max);
  brush.transformVertices(matrix);
  if (matrix.determinant() < 0) modifierStackReverseWinding(brush);
  return brush;
}
