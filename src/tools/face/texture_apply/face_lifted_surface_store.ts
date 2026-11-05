import { countTriangles } from '@/texture/uv/planar_uv_projector.js';
import type { TextureApplyTarget } from '@/texture/uv/face_texture_applier.js';

/**
 * Remembers the face region whose texture and alignment were last lifted, the
 * source of "Apply (texture + values)". A lifted region whose mesh left the
 * scene or lost the lifted triangles reads as nothing lifted.
 */
export class FaceLiftedSurfaceStore {
  private liftedTarget: TextureApplyTarget | null;

  /** Creates an empty store. */
  constructor() {
    this.liftedTarget = null;
  }

  /**
   * Records a lifted face region.
   *
   * @param target Region whose texture and alignment were lifted.
   */
  liftedTargetWrite(target: TextureApplyTarget): void {
    this.liftedTarget = {
      mesh: target.mesh,
      triangleIndices: target.triangleIndices.slice(),
      previousMapping: target.previousMapping,
    };
  }

  /**
   * Returns the lifted face region while it still describes live geometry.
   *
   * @returns Lifted region, or null when nothing usable was lifted.
   */
  liftedTargetRead(): TextureApplyTarget | null {
    const target = this.liftedTarget;
    if (!target || !this.liftedTargetIsLive(target)) {
      return null;
    }
    return target;
  }

  /** Forgets the lifted face region. */
  clear(): void {
    this.liftedTarget = null;
  }

  /**
   * Returns whether a lifted region still lives in a scene and its triangles
   * still exist on the mesh.
   *
   * @param target Lifted region.
   * @returns True when the region can still be read.
   */
  private liftedTargetIsLive(target: TextureApplyTarget): boolean {
    if (!target.mesh.parent || target.triangleIndices.length === 0) {
      return false;
    }
    const triangleCount = countTriangles(target.mesh.geometry);
    return target.triangleIndices.every((index) => index >= 0 && index < triangleCount);
  }
}
