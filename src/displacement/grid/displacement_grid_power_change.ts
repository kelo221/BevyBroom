import type { DisplacementFaceSurface, DisplacementPower } from '@/displacement/model/displacement_types.js';
import { displacementRowLength, displacementSurfaceClone } from '@/displacement/model/displacement_face_surface.js';
import {
  displacementSeamOffsetsComponentsJoin,
  displacementSeamOffsetsComponentsSplit,
} from '@/displacement/model/displacement_seam_offsets.js';
import { displacementGridResample } from './displacement_grid_resample.js';

/**
 * Returns a copy of a displacement at another subdivision power, resampling its
 * offsets, seam offsets and alphas over the same face. Raising the power
 * interpolates new vertices; lowering it keeps the vertices both grids share.
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
  if (displacement.seamOffsets) {
    copy.seamOffsets = displacementSeamOffsetsResample(displacement.seamOffsets, sourceRowLength, targetRowLength);
  }
  return copy;
}

/**
 * Resamples a flat seam offset list onto a grid with another side length, one
 * component at a time.
 *
 * @param seamOffsets Source flat seam offset list.
 * @param sourceRowLength Source vertices per side.
 * @param targetRowLength Target vertices per side.
 * @returns Target flat seam offset list.
 */
function displacementSeamOffsetsResample(
  seamOffsets: readonly number[],
  sourceRowLength: number,
  targetRowLength: number,
): number[] {
  const components = displacementSeamOffsetsComponentsSplit(seamOffsets).map((values) =>
    displacementGridResample(values, sourceRowLength, targetRowLength),
  );
  return displacementSeamOffsetsComponentsJoin(components);
}
