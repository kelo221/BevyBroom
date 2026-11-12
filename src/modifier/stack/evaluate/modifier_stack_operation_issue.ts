import type * as THREE from 'three';
import type { ModifierStackSettings } from '@/modifier/stack/modifier_stack_types.js';
import { MODIFIER_STACK_VOLUME_OPERATION_LABELS } from '@/modifier/stack/modifier_stack_volume_operation.js';
import { modifierStackOperationBoxFlatAxis } from './modifier_stack_operation_box.js';
import { modifierStackVolumeBox } from './modifier_stack_frame.js';
import type { ModifierStackStatus } from './modifier_stack_status.js';

/**
 * Explains why a volume with a boolean operation writes no box into any solid:
 * the box is empty or flat, or the volume captured no brushes.
 *
 * @param volume Modifier volume.
 * @param settings Normalized stack settings of the volume.
 * @param status Evaluation feedback of the volume, or null before evaluation.
 * @returns Reason text, or empty when the operation applies or is 'none'.
 */
export function modifierStackOperationIssue(
  volume: THREE.Object3D,
  settings: ModifierStackSettings,
  status: ModifierStackStatus | null,
): string {
  if (settings.operation === 'none') return '';
  const outcome = `so the ${MODIFIER_STACK_VOLUME_OPERATION_LABELS[settings.operation]} box is not written`;
  const shape = modifierStackOperationIssueShape(volume);
  if (shape) return `${shape}, ${outcome}`;
  if (status && status.captured === 0) return `the volume captures no brushes, ${outcome}`;
  return '';
}

/**
 * Describes a volume box that cannot enclose a solid.
 *
 * @param volume Modifier volume.
 * @returns Shape problem, or empty when the box has thickness on every axis.
 */
function modifierStackOperationIssueShape(volume: THREE.Object3D): string {
  const box = modifierStackVolumeBox(volume);
  if (box.isEmpty()) return 'the volume has no box';
  const axis = modifierStackOperationBoxFlatAxis(box);
  return axis ? `the volume has no thickness on its ${axis} axis` : '';
}
