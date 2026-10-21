import type { SolidModelController } from '@/solid/controller/solid_model_controller.js';
import type { SolidModel } from '@/solid/model/solid_model.js';

/**
 * Returns the solid model pasted brushes join: the active one, else the first
 * one in the world.
 *
 * @param solidModelController Solid model controller, or null before it exists.
 * @returns Solid model, or null when the world has none.
 */
export function clipboardSolidModelResolve(solidModelController: SolidModelController | null): SolidModel | null {
  if (solidModelController === null) {
    return null;
  }
  return solidModelController.resolveActiveModel() ?? solidModelController.findFirstSolidModelInWorld();
}
