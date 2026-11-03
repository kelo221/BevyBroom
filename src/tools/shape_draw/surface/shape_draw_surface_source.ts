import * as THREE from 'three';
import type { SolidBrush } from '@/solid/brush/solid_brush.js';
import type { SolidPlane } from '@/solid/brush/solid_plane.js';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import {
  cloneFaceSurface,
  deserializeFaceSurface,
  type FaceSurfaceDescription,
} from '@/texture/uv_matrix/face_surface_description.js';

/**
 * Frozen copy of one shape piece's geometry, model pose and face surfaces,
 * taken before the piece is replaced.
 */
export class ShapeDrawSurfaceSource {
  /** Brush-local geometry of the piece. */
  readonly brush: SolidBrush;
  /** Brush-local to model-space matrix of the piece. */
  readonly modelMatrix: THREE.Matrix4;
  /** Face planes in model space, indexed like the brush faces. */
  readonly modelPlanes: readonly SolidPlane[];
  /** Surface used by faces without an override. */
  readonly defaultSurface: FaceSurfaceDescription;
  private readonly faceSurfaces: readonly (FaceSurfaceDescription | undefined)[];

  /**
   * Creates a surface source.
   *
   * @param brush Brush-local geometry.
   * @param modelMatrix Brush-local to model-space matrix.
   * @param defaultSurface Default surface.
   * @param faceSurfaces Sparse per-face overrides.
   */
  constructor(
    brush: SolidBrush,
    modelMatrix: THREE.Matrix4,
    defaultSurface: FaceSurfaceDescription,
    faceSurfaces: readonly (FaceSurfaceDescription | undefined)[],
  ) {
    this.brush = brush;
    this.modelMatrix = modelMatrix;
    this.modelPlanes = brush.planes.map((plane) => plane.applyMatrix4(modelMatrix));
    this.defaultSurface = defaultSurface;
    this.faceSurfaces = faceSurfaces;
  }

  /**
   * Snapshots a brush instance that is still placed in its solid model.
   *
   * @param instance Brush instance to copy.
   * @returns Independent surface source.
   */
  static fromBrushInstance(instance: SolidBrushInstance): ShapeDrawSurfaceSource {
    return new ShapeDrawSurfaceSource(
      instance.brush.clone(),
      instance.getModelSpaceMatrix().clone(),
      deserializeFaceSurface(instance.serializeDefaultSurface()),
      instance.serializeFaceSurfaces().map((surface) => (surface ? deserializeFaceSurface(surface) : undefined)),
    );
  }

  /**
   * Returns the override stored on one face.
   *
   * @param faceIndex Brush face index.
   * @returns Cloned override, or undefined when the face uses the default.
   */
  faceOverrideRead(faceIndex: number): FaceSurfaceDescription | undefined {
    const override = this.faceSurfaces[faceIndex];
    return override ? cloneFaceSurface(override) : undefined;
  }
}
