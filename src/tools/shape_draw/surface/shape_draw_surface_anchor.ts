import * as THREE from 'three';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import {
  deserializeFaceSurface,
  orientDefaultFaceSurface,
  type FaceSurfaceDescription,
} from '@/texture/uv_matrix/face_surface_description.js';
import {
  transformBrushLocalUvForPoseChange,
  type SurfaceUvLockFlags,
} from '@/texture/uv_matrix/surface_uv_matrix_transform.js';

/**
 * Lock flags that rewrite a UV matrix so its texture stays fixed in model
 * space.
 */
export const SHAPE_DRAW_SURFACE_MODEL_FIXED_UV_LOCKS: SurfaceUvLockFlags = { positionLock: false, stretchLock: false };

/** Pose of a brush sitting at the model origin with no rotation or scale. */
const SHAPE_DRAW_SURFACE_MODEL_ORIGIN_MATRIX = new THREE.Matrix4();

/**
 * Anchors default face surfaces of shape pieces to the model origin, so every
 * piece of one shape shares a single continuous texture grid.
 */
export class ShapeDrawSurfaceAnchor {
  /**
   * Replaces every face surface of a piece with its default surface anchored to
   * the model origin.
   *
   * @param instance Piece brush.
   * @param pieceModelMatrix Brush-local to model-space matrix of the piece.
   */
  static surfacesAnchor(instance: SolidBrushInstance, pieceModelMatrix: THREE.Matrix4): void {
    const defaultSurface = deserializeFaceSurface(instance.serializeDefaultSurface());
    const faceSurfaces = instance.brush.planes.map((_, faceIndex) =>
      ShapeDrawSurfaceAnchor.faceDefaultAnchor(instance, faceIndex, defaultSurface, pieceModelMatrix),
    );
    instance.restoreFaceSurfaces(defaultSurface, faceSurfaces);
  }

  /**
   * Builds the default surface of one face as if authored at the model origin,
   * then rewrites its UV matrix into the piece frame.
   *
   * @param instance Piece brush.
   * @param faceIndex Face index on the piece.
   * @param defaultSurface Surface whose texture and UV transform are used.
   * @param pieceModelMatrix Brush-local to model-space matrix of the piece.
   * @returns Model-anchored face surface in the piece frame.
   */
  static faceDefaultAnchor(
    instance: SolidBrushInstance,
    faceIndex: number,
    defaultSurface: FaceSurfaceDescription,
    pieceModelMatrix: THREE.Matrix4,
  ): FaceSurfaceDescription {
    const faceNormalLocal = instance.faceNormalLocal(faceIndex);
    const faceNormalModel = faceNormalLocal.clone().transformDirection(pieceModelMatrix);
    const anchored = orientDefaultFaceSurface(defaultSurface, faceNormalModel);
    anchored.uv = transformBrushLocalUvForPoseChange(
      anchored.uv,
      faceNormalLocal,
      instance.facePlaneOffsetLocal(faceIndex),
      SHAPE_DRAW_SURFACE_MODEL_ORIGIN_MATRIX,
      pieceModelMatrix,
      SHAPE_DRAW_SURFACE_MODEL_FIXED_UV_LOCKS,
    );
    return anchored;
  }
}
