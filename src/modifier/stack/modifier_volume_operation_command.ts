import type * as THREE from 'three';
import type { UndoCommand } from '@/commands/command_undo.js';
import { SolidOperation, solidOperationToggleAdditiveSubtractive } from '@/solid/types/solid_operation.js';
import { CommandModifierStackSet } from './command_modifier_stack_set.js';
import { ModifierVolume } from './modifier_volume.js';
import {
  modifierStackVolumeOperationIsBoolean,
  modifierStackVolumeOperationOfSolid,
  modifierStackVolumeOperationSolidOf,
} from './modifier_stack_volume_operation.js';

/**
 * Reads the CSG operation a volume applies to its box. A volume without a
 * boolean operation reads as additive, so the solid buttons start from there.
 *
 * @param volume Modifier volume.
 * @returns Solid CSG operation.
 */
export function modifierVolumeSolidOperationRead(volume: THREE.Object3D): SolidOperation {
  return modifierVolumeSolidOperationOrNull(volume) ?? SolidOperation.Additive;
}

/**
 * Reads the CSG operation a volume applies to its box.
 *
 * @param volume Modifier volume.
 * @returns Solid CSG operation, or null when the volume has no boolean
 *   operation.
 */
export function modifierVolumeSolidOperationOrNull(volume: THREE.Object3D): SolidOperation | null {
  const operation = ModifierVolume.read(volume).operation;
  return modifierStackVolumeOperationIsBoolean(operation) ? modifierStackVolumeOperationSolidOf(operation) : null;
}

/**
 * Builds the undoable edit that stores a solid CSG operation on a volume, as
 * the solid Additive / Subtractive / Intersecting buttons do for brushes.
 *
 * @param volume Modifier volume.
 * @param operation New solid CSG operation.
 * @returns Command, or null when the volume already has that operation.
 */
export function modifierVolumeOperationCommand(volume: THREE.Object3D, operation: SolidOperation): UndoCommand | null {
  const before = ModifierVolume.read(volume);
  const after = { ...before, operation: modifierStackVolumeOperationOfSolid(operation) };
  if (after.operation === before.operation) return null;
  return new CommandModifierStackSet(volume, before, after);
}

/**
 * Builds operation edits for several volumes.
 *
 * @param volumes Modifier volumes.
 * @param operation New solid CSG operation.
 * @returns Commands for the volumes that change.
 */
export function modifierVolumeOperationCommands(
  volumes: readonly THREE.Object3D[],
  operation: SolidOperation,
): UndoCommand[] {
  return volumes.flatMap((volume) => modifierVolumeOperationCommandList(volume, operation));
}

/**
 * Builds edits that flip each volume between additive and subtractive, like the
 * brush toggle. Intersecting volumes stay unchanged.
 *
 * @param volumes Modifier volumes.
 * @returns Commands for the volumes that change.
 */
export function modifierVolumeOperationToggleCommands(volumes: readonly THREE.Object3D[]): UndoCommand[] {
  return volumes.flatMap((volume) => {
    const next = solidOperationToggleAdditiveSubtractive(modifierVolumeSolidOperationRead(volume));
    return next === null ? [] : modifierVolumeOperationCommandList(volume, next);
  });
}

/**
 * Wraps the optional command of one volume in a list.
 *
 * @param volume Modifier volume.
 * @param operation New solid CSG operation.
 * @returns Zero or one command.
 */
function modifierVolumeOperationCommandList(volume: THREE.Object3D, operation: SolidOperation): UndoCommand[] {
  const command = modifierVolumeOperationCommand(volume, operation);
  return command ? [command] : [];
}
