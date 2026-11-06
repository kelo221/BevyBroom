import type { DisplacementPaintTool, DisplacementSculptEffect } from '@/displacement/model/displacement_types.js';
import type { DisplacementSculptBrush } from './displacement_sculpt_brush.js';
import { DisplacementSculptBrushAlpha } from './displacement_sculpt_brush_alpha.js';
import { DisplacementSculptBrushFlatten } from './displacement_sculpt_brush_flatten.js';
import { DisplacementSculptBrushNoise } from './displacement_sculpt_brush_noise.js';
import { DisplacementSculptBrushRaiseLower } from './displacement_sculpt_brush_raise_lower.js';
import { DisplacementSculptBrushRaiseTo } from './displacement_sculpt_brush_raise_to.js';
import { DisplacementSculptBrushSmooth } from './displacement_sculpt_brush_smooth.js';

/**
 * Creates the paint brush of a paint tool: Paint Alpha always paints alphas,
 * Paint Geometry uses the brush of its effect.
 *
 * @param tool Paint tool.
 * @param effect Paint Geometry effect.
 * @param seed Random seed used by effects with random output.
 * @returns New brush.
 */
export function displacementSculptBrushCreate(
  tool: DisplacementPaintTool,
  effect: DisplacementSculptEffect,
  seed: number,
): DisplacementSculptBrush {
  if (tool === 'paint_alpha') {
    return new DisplacementSculptBrushAlpha();
  }
  return displacementSculptBrushGeometryCreate(effect, seed);
}

/**
 * Creates the Paint Geometry brush of an effect.
 *
 * @param effect Paint Geometry effect.
 * @param seed Random seed used by effects with random output.
 * @returns New brush.
 */
function displacementSculptBrushGeometryCreate(
  effect: DisplacementSculptEffect,
  seed: number,
): DisplacementSculptBrush {
  switch (effect) {
    case 'raise_lower':
      return new DisplacementSculptBrushRaiseLower();
    case 'raise_to':
      return new DisplacementSculptBrushRaiseTo();
    case 'smooth':
      return new DisplacementSculptBrushSmooth();
    case 'noise':
      return new DisplacementSculptBrushNoise(seed);
    case 'flatten':
      return new DisplacementSculptBrushFlatten();
  }
}
