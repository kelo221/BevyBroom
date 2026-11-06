import type * as THREE from 'three';
import { SolidModel } from '@/solid/model/solid_model.js';
import { SOLID_TRIANGLE_SOURCES_USERDATA_KEY } from '@/solid/model/solid_model_keys.js';
import type { SolidFaceTextureTarget } from '@/texture/commands/command_texture_solid_face_edit.js';
import type { FaceSelection } from './manager_face_selection.js';
import { findFirstTriangleForBrushSurface } from './solid_triangle_source_index.js';

/**
 * Maps a solid result triangle back to the authored brush face it came from.
 *
 * @param mesh Solid result mesh.
 * @param triangleIndex Triangle index on the result mesh.
 * @returns Brush face target, or null when the triangle has no brush source.
 */
export function solidFaceTargetFromResultTriangle(
  mesh: THREE.Mesh,
  triangleIndex: number,
): SolidFaceTextureTarget | null {
  const model = SolidModel.fromObject(mesh);
  if (!model) return null;
  const sources = mesh.userData[SOLID_TRIANGLE_SOURCES_USERDATA_KEY] as
    Array<{ brushId: string; surfaceIndex: number } | undefined> | undefined;
  const source = sources?.[triangleIndex];
  if (!source?.brushId) return null;
  return { model, brushId: source.brushId, surfaceIndex: source.surfaceIndex };
}

/**
 * Maps face selections on solid result meshes to unique brush face targets.
 * Selections on other meshes are skipped.
 *
 * @param faces Face selections.
 * @returns One target per distinct brush face, in selection order.
 */
export function solidFaceTargetsFromSelections(faces: readonly FaceSelection[]): SolidFaceTextureTarget[] {
  const targets: SolidFaceTextureTarget[] = [];
  const seen = new Set<string>();
  for (const face of faces) {
    const target = SolidModel.isResultMesh(face.mesh)
      ? solidFaceTargetFromResultTriangle(face.mesh, face.faceIndex)
      : null;
    const key = target ? `${target.model.root.uuid}|${target.brushId}|${target.surfaceIndex}` : '';
    if (!target || seen.has(key)) continue;
    seen.add(key);
    targets.push(target);
  }
  return targets;
}

/**
 * Maps brush face targets to face selection seeds on their models' result
 * meshes. Targets whose face has no result triangle are skipped.
 *
 * @param targets Brush faces.
 * @returns One seed per target that shows on its result mesh.
 */
export function solidFaceSelectionSeedsFromTargets(targets: readonly SolidFaceTextureTarget[]): FaceSelection[] {
  return targets.flatMap((target) => {
    const mesh = target.model.getResultMesh();
    const faceIndex = findFirstTriangleForBrushSurface(mesh, target.brushId, target.surfaceIndex);
    return faceIndex < 0 ? [] : [{ mesh, faceIndex }];
  });
}
