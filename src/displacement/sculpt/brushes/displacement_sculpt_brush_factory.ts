import type { DisplacementSculptTool } from '@/displacement/model/displacement_types.js';
import type { DisplacementSculptBrush } from './displacement_sculpt_brush.js';
import { DisplacementSculptBrushFlatten } from './displacement_sculpt_brush_flatten.js';
import { DisplacementSculptBrushNoise } from './displacement_sculpt_brush_noise.js';
import { DisplacementSculptBrushRaiseLower } from './displacement_sculpt_brush_raise_lower.js';
import { DisplacementSculptBrushSmooth } from './displacement_sculpt_brush_smooth.js';

/**
 * Creates the paint brush of a sculpt tool.
 *
 * @param tool Sculpt tool.
 * @param seed Random seed used by tools with random output.
 * @returns New brush.
 */
export function displacementSculptBrushCreate(tool: DisplacementSculptTool, seed: number): DisplacementSculptBrush {
  switch (tool) {
    case 'raise_lower':
      return new DisplacementSculptBrushRaiseLower();
    case 'smooth':
      return new DisplacementSculptBrushSmooth();
    case 'noise':
      return new DisplacementSculptBrushNoise(seed);
    case 'flatten':
      return new DisplacementSculptBrushFlatten();
  }
}
