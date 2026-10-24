import type { FaceSelection } from '@/selection/face/manager_face_selection.js';
import { buildFacePickRegionKey, parseSolidRegionKey } from '@/selection/face/solid_triangle_source_index.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import type { ConvexMergeFacePick } from '@/tools/csg/solid/merge/convex_merge_face_points.js';

/**
 * Turns a solid result face selection into brush face picks.
 *
 * @param selected Selected faces of solid result meshes.
 * @returns Brush face picks in selection order.
 */
export function convexMergeFacePicksFromSelection(selected: readonly FaceSelection[]): ConvexMergeFacePick[] {
  const picks: ConvexMergeFacePick[] = [];
  for (const entry of selected) {
    convexMergeFacePickPush(picks, entry);
  }
  return picks;
}

/**
 * Appends one selected face when it belongs to an authored brush face.
 *
 * @param picks Pick accumulator.
 * @param entry Selected face of a solid result mesh.
 */
function convexMergeFacePickPush(picks: ConvexMergeFacePick[], entry: FaceSelection): void {
  const regionKey = entry.regionKey ?? buildFacePickRegionKey(entry.mesh, entry.faceIndex);
  const identity = parseSolidRegionKey(regionKey, entry.mesh.uuid);
  if (!identity) {
    return;
  }
  const model = SolidModel.fromObject(entry.mesh);
  const instance = model?.findBrush(identity.brushId);
  if (!instance) {
    return;
  }
  picks.push({ instance, faceIndex: identity.surfaceIndex });
}
