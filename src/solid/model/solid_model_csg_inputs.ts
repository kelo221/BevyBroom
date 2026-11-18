import type * as THREE from 'three';
import type { SolidCsgInputs } from '@/solid/algorithm/compile/solid_compile_types.js';

/** Reads the inputs of a solid model's last compile. */
type SolidModelCsgInputsReader = () => SolidCsgInputs;

/** Reader of every live solid model by its root group. */
const SOLID_MODEL_CSG_INPUTS_READERS = new WeakMap<THREE.Object3D, SolidModelCsgInputsReader>();

/**
 * Makes the inputs of a solid model's compiles readable through its root.
 *
 * @param solidRoot Root group of the solid model.
 * @param reader Returns the inputs of the model's last compile.
 */
export function solidModelCsgInputsRegister(solidRoot: THREE.Object3D, reader: SolidModelCsgInputsReader): void {
  SOLID_MODEL_CSG_INPUTS_READERS.set(solidRoot, reader);
}

/**
 * Returns the brushes, in solid model space, and the operation tree the last
 * compile of a solid model combined.
 *
 * @param solidRoot Root group of the solid model.
 * @returns Prepared brushes, tree and inverted world flag, or null for an
 *   object that is no solid model root.
 */
export function solidModelCsgInputsRead(solidRoot: THREE.Object3D): SolidCsgInputs | null {
  return SOLID_MODEL_CSG_INPUTS_READERS.get(solidRoot)?.() ?? null;
}
