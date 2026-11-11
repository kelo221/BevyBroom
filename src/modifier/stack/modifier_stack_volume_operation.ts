import { SolidOperation } from '@/solid/types/solid_operation.js';
import type { ModifierStackVolumeOperation } from './modifier_stack_types.js';

/** Every volume operation, in the order the inspector lists them. */
export const MODIFIER_STACK_VOLUME_OPERATIONS: readonly ModifierStackVolumeOperation[] = [
  'none',
  'add',
  'subtract',
  'intersect',
];

/** Inspector label of each volume operation. */
export const MODIFIER_STACK_VOLUME_OPERATION_LABELS: Readonly<Record<ModifierStackVolumeOperation, string>> = {
  none: 'None',
  add: 'Additive',
  subtract: 'Subtractive',
  intersect: 'Intersecting',
};

/** Volume operations that write a box brush into the solid. */
export type ModifierStackBooleanVolumeOperation = Exclude<ModifierStackVolumeOperation, 'none'>;

/** Solid CSG operation each boolean volume operation writes into its box brush. */
const MODIFIER_STACK_VOLUME_SOLID_OPERATIONS: Readonly<Record<ModifierStackBooleanVolumeOperation, SolidOperation>> = {
  add: SolidOperation.Additive,
  subtract: SolidOperation.Subtractive,
  intersect: SolidOperation.Intersecting,
};

/** Stored volume operation of each solid CSG operation. */
const MODIFIER_STACK_SOLID_OPERATION_VOLUME_CHOICES: Readonly<
  Record<SolidOperation, ModifierStackBooleanVolumeOperation>
> = {
  [SolidOperation.Additive]: 'add',
  [SolidOperation.Subtractive]: 'subtract',
  [SolidOperation.Intersecting]: 'intersect',
};

/**
 * Keeps a stored volume operation when it is known, otherwise returns 'none'.
 *
 * @param stored Stored or user-supplied operation.
 * @returns Valid volume operation.
 */
export function modifierStackVolumeOperationNormalize(stored: unknown): ModifierStackVolumeOperation {
  return MODIFIER_STACK_VOLUME_OPERATIONS.find((operation) => operation === stored) ?? 'none';
}

/**
 * Returns whether a volume operation writes a box brush into the solid.
 *
 * @param operation Volume operation.
 * @returns True for add, subtract and intersect.
 */
export function modifierStackVolumeOperationIsBoolean(
  operation: ModifierStackVolumeOperation,
): operation is ModifierStackBooleanVolumeOperation {
  return operation !== 'none';
}

/**
 * Returns the solid CSG operation a boolean volume operation maps to.
 *
 * @param operation Boolean volume operation.
 * @returns Solid CSG operation.
 */
export function modifierStackVolumeOperationSolidOf(operation: ModifierStackBooleanVolumeOperation): SolidOperation {
  return MODIFIER_STACK_VOLUME_SOLID_OPERATIONS[operation];
}

/**
 * Returns the stored volume operation for a solid CSG operation.
 *
 * @param operation Solid CSG operation.
 * @returns Boolean volume operation that writes that CSG operation.
 */
export function modifierStackVolumeOperationOfSolid(operation: SolidOperation): ModifierStackBooleanVolumeOperation {
  return MODIFIER_STACK_SOLID_OPERATION_VOLUME_CHOICES[operation];
}
