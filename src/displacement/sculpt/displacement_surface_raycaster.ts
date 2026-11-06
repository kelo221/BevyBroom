import type * as THREE from 'three';
import { RaycasterFaceSelection } from '@/selection/face/raycaster_face_selection.js';
import type { SolidFaceTextureTarget } from '@/texture/commands/command_texture_solid_face_edit.js';
import { displacementSurfaceMeshFind } from '@/displacement/mesh/displacement_surface_mesh_keys.js';

/** Point where a pointer ray meets a displacement surface. */
export interface DisplacementSurfaceHit {
  /** World-space hit point. */
  point: THREE.Vector3;
  /** Unit world-space normal of the hit surface triangle, facing the camera. */
  normal: THREE.Vector3;
}

/**
 * Lists the displacement surface meshes of a set of brush faces.
 *
 * @param targets Brush faces.
 * @returns Surface meshes of the displaced faces among the targets.
 */
export function displacementSurfaceMeshesOfTargets(targets: readonly SolidFaceTextureTarget[]): THREE.Mesh[] {
  return targets.flatMap((target) => {
    const surfaceMesh = displacementSurfaceMeshFind(target.model.root, target.brushId, target.surfaceIndex);
    return surfaceMesh ? [surfaceMesh] : [];
  });
}

/** Raycasts the displacement surfaces of brush faces under a pointer. */
export class DisplacementSurfaceRaycaster {
  private readonly raycaster = new RaycasterFaceSelection();

  /**
   * Finds the closest front-facing displacement surface point of the targets
   * under the pointer.
   *
   * @param event Pointer event with client coordinates.
   * @param camera Viewport camera.
   * @param pickElement Viewport content element.
   * @param targets Brush faces whose displacement surfaces are tested.
   * @returns Hit point and normal, or null when no target surface is under the
   *   pointer.
   */
  hitRead(
    event: MouseEvent,
    camera: THREE.Camera,
    pickElement: HTMLElement,
    targets: readonly SolidFaceTextureTarget[],
  ): DisplacementSurfaceHit | null {
    const surfaceMeshes = displacementSurfaceMeshesOfTargets(targets);
    if (surfaceMeshes.length === 0) {
      return null;
    }
    const pick = this.raycaster.pickFace(event, camera, pickElement, surfaceMeshes);
    return pick ? { point: pick.hitPoint, normal: pick.faceNormal } : null;
  }

  /** Releases the underlying face raycaster. */
  dispose(): void {
    this.raycaster.dispose();
  }
}
