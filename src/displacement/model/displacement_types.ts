/**
 * Subdivision power of a displacement: the grid has 2^power + 1 vertices per
 * side.
 */
export type DisplacementPower = 2 | 3 | 4;

/** Every subdivision power a displacement may use, smallest first. */
export const DISPLACEMENT_POWERS: readonly DisplacementPower[] = [2, 3, 4];

/** Largest alpha value a displacement vertex stores (texture blend weight). */
export const DISPLACEMENT_ALPHA_MAX = 255;

/** Sculpt tools that paint offsets onto a displacement. */
export type DisplacementSculptTool = 'raise_lower' | 'smooth' | 'noise' | 'flatten';

/** Every sculpt tool, in panel order. */
export const DISPLACEMENT_SCULPT_TOOLS: readonly DisplacementSculptTool[] = [
  'raise_lower',
  'smooth',
  'noise',
  'flatten',
];

/**
 * Sculpted heightfield attached to one four-sided brush face. Vertex lists are
 * row-major: index = row * (2^power + 1) + column, column running from the
 * face's first corner to its second, row from the first corner to its fourth.
 */
export interface DisplacementFaceSurface {
  /** Subdivision power of the grid. */
  power: DisplacementPower;
  /** Distance in meters the whole surface sits above the face along its normal. */
  elevation: number;
  /** Multiplier applied to every vertex offset. */
  scale: number;
  /** Per-vertex distance in meters along the face normal, before scale. */
  offsets: number[];
  /** Per-vertex texture blend alpha from 0 to DISPLACEMENT_ALPHA_MAX. */
  alphas: number[];
}
