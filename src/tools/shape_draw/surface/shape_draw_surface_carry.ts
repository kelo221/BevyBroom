import type * as THREE from 'three';
import type { SolidPlane } from '@/solid/brush/solid_plane.js';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import type { SolidBrushSurfaceMatcher } from '@/solid/brush/surface_matcher/solid_brush_surface_matcher.js';
import { SolidBrushSurfaceMatcherNormal } from '@/solid/brush/surface_matcher/solid_brush_surface_matcher_normal.js';
import { SolidBrushSurfaceMatcherFacing } from '@/solid/brush/surface_matcher/solid_brush_surface_matcher_facing.js';
import { reorientFaceSurface, type FaceSurfaceDescription } from '@/texture/uv_matrix/face_surface_description.js';
import {
  transformBrushLocalUvForPoseChange,
  type SurfaceUvLockFlags,
} from '@/texture/uv_matrix/surface_uv_matrix_transform.js';
import { ShapeDrawSurfaceSource } from './shape_draw_surface_source.js';

/** Lock flags that keep carried UVs fixed in model space. */
const SHAPE_DRAW_SURFACE_CARRY_UV_LOCKS: SurfaceUvLockFlags = { positionLock: false, stretchLock: false };

/** One source face a new face inherits from. */
interface ShapeDrawSurfaceCarryMatch {
  /** Piece owning the face. */
  source: ShapeDrawSurfaceSource;
  /** Face index on that piece. */
  faceIndex: number;
}

/**
 * Carries the face surfaces of a shape group's old pieces onto the pieces that
 * replace them, keeping textures fixed in model space.
 */
export class ShapeDrawSurfaceCarry {
  private readonly sources: readonly ShapeDrawSurfaceSource[];
  private readonly groupModelPlanes: SolidPlane[] = [];
  private readonly groupFaces: ShapeDrawSurfaceCarryMatch[] = [];
  private readonly matcherNormal = new SolidBrushSurfaceMatcherNormal();
  private readonly matcherFacing = new SolidBrushSurfaceMatcherFacing();

  /**
   * Creates a carry over frozen piece sources.
   *
   * @param sources Old pieces in piece order.
   */
  constructor(sources: readonly ShapeDrawSurfaceSource[]) {
    this.sources = sources;
    sources.forEach((source) => this.groupFacesAppend(source));
  }

  /**
   * Snapshots the brushes of a shape group before they are replaced.
   *
   * @param brushes Old pieces in piece order, still placed in their model.
   * @returns Carry over those pieces.
   */
  static fromBrushes(brushes: readonly SolidBrushInstance[]): ShapeDrawSurfaceCarry {
    return new ShapeDrawSurfaceCarry(brushes.map((brush) => ShapeDrawSurfaceSource.fromBrushInstance(brush)));
  }

  /**
   * Writes carried surfaces onto one new piece. Leaves the piece untouched when
   * there are no old pieces.
   *
   * @param instance New piece brush.
   * @param pieceIndex Index of the piece in the new piece order.
   * @param pieceModelMatrix Brush-local to model-space matrix of the new piece.
   */
  surfacesApply(instance: SolidBrushInstance, pieceIndex: number, pieceModelMatrix: THREE.Matrix4): void {
    const source = this.pieceSourceResolve(pieceIndex);
    if (!source) {
      return;
    }
    const faceSurfaces = instance.brush.planes.map((plane, faceIndex) =>
      this.faceSurfaceCarry(instance, faceIndex, plane.applyMatrix4(pieceModelMatrix), source, pieceModelMatrix),
    );
    instance.restoreFaceSurfaces(source.defaultSurface, faceSurfaces);
  }

  /**
   * Registers every face of a source so group-wide searches can reach it.
   *
   * @param source Old piece.
   */
  private groupFacesAppend(source: ShapeDrawSurfaceSource): void {
    source.modelPlanes.forEach((plane, faceIndex) => {
      this.groupModelPlanes.push(plane);
      this.groupFaces.push({ source, faceIndex });
    });
  }

  /**
   * Returns the old piece a new piece inherits from: the same index, else the
   * last old piece.
   *
   * @param pieceIndex New piece index.
   * @returns Old piece, or null when there are none.
   */
  private pieceSourceResolve(pieceIndex: number): ShapeDrawSurfaceSource | null {
    return this.sources[pieceIndex] ?? this.sources[this.sources.length - 1] ?? null;
  }

  /**
   * Resolves the surface one new face inherits.
   *
   * @param instance New piece brush.
   * @param faceIndex New face index.
   * @param faceModelPlane New face plane in model space.
   * @param source Old piece preferred for this new piece.
   * @param pieceModelMatrix Brush-local to model-space matrix of the new piece.
   * @returns Face override, or undefined to use the default surface.
   */
  private faceSurfaceCarry(
    instance: SolidBrushInstance,
    faceIndex: number,
    faceModelPlane: SolidPlane,
    source: ShapeDrawSurfaceSource,
    pieceModelMatrix: THREE.Matrix4,
  ): FaceSurfaceDescription | undefined {
    const parallelMatch = this.matchFind(this.matcherNormal, source, faceModelPlane);
    if (parallelMatch) {
      return this.surfaceRebase(parallelMatch, instance, faceIndex, pieceModelMatrix);
    }
    const facingMatch = this.matchFind(this.matcherFacing, source, faceModelPlane);
    return facingMatch ? this.surfaceReorient(facingMatch, instance.faceNormalLocal(faceIndex)) : undefined;
  }

  /**
   * Finds a source face on the preferred piece, else anywhere in the group.
   *
   * @param matcher Face matcher comparing model-space planes.
   * @param source Old piece preferred for this new piece.
   * @param faceModelPlane New face plane in model space.
   * @returns Matched source face, or null.
   */
  private matchFind(
    matcher: SolidBrushSurfaceMatcher,
    source: ShapeDrawSurfaceSource,
    faceModelPlane: SolidPlane,
  ): ShapeDrawSurfaceCarryMatch | null {
    const preferredIndex = matcher.faceMatchFind(source.modelPlanes, faceModelPlane);
    if (preferredIndex >= 0) {
      return { source, faceIndex: preferredIndex };
    }
    return this.groupFaces[matcher.faceMatchFind(this.groupModelPlanes, faceModelPlane)] ?? null;
  }

  /**
   * Copies a parallel source face override and rewrites its UV matrix so the
   * texture stays where it was in model space.
   *
   * @param match Parallel source face.
   * @param instance New piece brush.
   * @param faceIndex New face index.
   * @param pieceModelMatrix Brush-local to model-space matrix of the new piece.
   * @returns Rebased override, or undefined when the source face has none.
   */
  private surfaceRebase(
    match: ShapeDrawSurfaceCarryMatch,
    instance: SolidBrushInstance,
    faceIndex: number,
    pieceModelMatrix: THREE.Matrix4,
  ): FaceSurfaceDescription | undefined {
    const override = match.source.faceOverrideRead(match.faceIndex);
    if (!override) {
      return undefined;
    }
    override.uv = transformBrushLocalUvForPoseChange(
      override.uv,
      instance.faceNormalLocal(faceIndex),
      instance.facePlaneOffsetLocal(faceIndex),
      match.source.modelMatrix,
      pieceModelMatrix,
      SHAPE_DRAW_SURFACE_CARRY_UV_LOCKS,
    );
    return override;
  }

  /**
   * Copies a non-parallel source face override, keeping its texture, offset,
   * rotation and scale but projecting along the new face normal.
   *
   * @param match Closest-facing source face.
   * @param faceNormalLocal Brush-local normal of the new face.
   * @returns Reoriented override, or undefined when the source face has none.
   */
  private surfaceReorient(
    match: ShapeDrawSurfaceCarryMatch,
    faceNormalLocal: THREE.Vector3,
  ): FaceSurfaceDescription | undefined {
    const override = match.source.faceOverrideRead(match.faceIndex);
    if (!override) {
      return undefined;
    }
    return reorientFaceSurface(override, match.source.brush.faceNormalLocal(match.faceIndex), faceNormalLocal);
  }
}
