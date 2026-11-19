import { solidHullBrushFromPoints } from '@/solid/algorithm/surface/solid_hull_brush.js';
import { SolidBrushValidator } from '@/solid/brush/solid_brush_validator.js';
import { brushToWorkingGeometry, workingGeometryToBrush } from './topology_working_from_brush.js';
import type { TopologyWorkingGeometry } from './topology_working_geometry.js';

/** What a dragged brush needs after its corners moved. */
export type TopologyDragBrushConvexOutcome = 'valid' | 'rebuilt' | 'not_convex';

/**
 * Makes dragged brush corners a valid convex brush. A brush that is still valid
 * stays as it is. Otherwise the brush becomes the convex hull of its corners,
 * which splits bent faces into flat ones. When a corner would end up inside
 * that hull the corners do not form a convex solid (a bow-tie or a dent) and
 * nothing changes.
 *
 * @param geometry Working geometry of the brush, replaced in place when
 *   rebuilt.
 * @returns Valid, rebuilt as the hull, or not convex.
 */
export function topologyDragBrushConvexResolve(geometry: TopologyWorkingGeometry): TopologyDragBrushConvexOutcome {
  const brush = workingGeometryToBrush(geometry);
  if (brush && SolidBrushValidator.validate(brush).valid) {
    return 'valid';
  }
  const hull = solidHullBrushFromPoints(geometry.positions);
  if (!hull || hull.vertices.length < geometry.positions.length) {
    return 'not_convex';
  }
  const rebuilt = brushToWorkingGeometry(hull);
  geometry.positions = rebuilt.positions;
  geometry.faces = rebuilt.faces;
  return 'rebuilt';
}
