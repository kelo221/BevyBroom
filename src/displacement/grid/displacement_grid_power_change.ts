import type { DisplacementFaceSurface, DisplacementPower } from '@/displacement/model/displacement_types.js';
import { displacementRowLength, displacementSurfaceClone } from '@/displacement/model/displacement_face_surface.js';
import { displacementGridResample } from './displacement_grid_resample.js';

/**
 * Returns a copy of a displacement at another subdivision power, resampling its
 * offsets and alphas over the same face. Raising the power interpolates new
 * vertices; lowering it keeps the vertices both grids share.
 *
 * @param displacement Source displacement.
 * @param power Power of the copy.
 * @returns New displacement with the source's elevation, scale and flags.
 */
export function displacementPowerChange(
  displacement: Readonly<DisplacementFaceSurface>,
  power: DisplacementPower,
): DisplacementFaceSurface {
  const copy = displacementSurfaceClone(displacement);
  if (power === displacement.power) {
    return copy;
  }
  const sourceRowLength = displacementRowLength(displacement.power);
  const targetRowLength = displacementRowLength(power);
  copy.power = power;
  copy.offsets = displacementGridResample(displacement.offsets, sourceRowLength, targetRowLength);
  copy.alphas = displacementGridResample(displacement.alphas, sourceRowLength, targetRowLength);
  return copy;
}
