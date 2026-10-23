import * as THREE from 'three';
import { SolidBrush } from '@/solid/brush/solid_brush.js';
import { SolidPlane } from '@/solid/brush/solid_plane.js';
import { SolidHalfspaceIntersection } from '@/solid/brush/solid_halfspace_intersection.js';
import { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import { solidHullBrushFromPoints } from '@/solid/algorithm/surface/solid_hull_brush.js';
import type { SolidShapeBrushPiece } from '@/solid/commands/brushes/command_solid_shape_brushes_add.js';
import type { FaceSurfaceDescription } from '@/texture/uv_matrix/face_surface_description.js';
import type { SolidBrushHullSourceFace } from '@/tools/hull/solid_brush_hull_surface.js';
import { solidBrushHullMatchSurface } from '@/tools/hull/solid_brush_hull_surface.js';

/** Smallest wall thickness a hollow can use. */
export const HOLLOW_MIN_THICKNESS = 1e-4;

/** One hollow wall piece ready to become a brush. */
export interface HollowWallBuild {
  /** Centered convex wall piece in model space. */
  piece: SolidShapeBrushPiece;
  /** Surface for each wall face, in piece order. */
  surfaces: FaceSurfaceDescription[];
  /** Index of the original brush face this wall wraps. */
  sourceFaceIndex: number;
}

/**
 * Builds the hollow walls of one brush in model space. Each wall covers the
 * band between one face plane and the same plane moved inward by the thickness,
 * clipped by the earlier faces' inward planes so walls never overlap.
 *
 * @param instance Brush instance providing face surfaces.
 * @param modelSpaceBrush Brush geometry in model space.
 * @param thickness Wall thickness in model units.
 * @returns Walls in face order, or null when the brush is too thin to hollow.
 */
export function hollowWallsBuild(
  instance: SolidBrushInstance,
  modelSpaceBrush: SolidBrush,
  thickness: number,
): HollowWallBuild[] | null {
  if (thickness < HOLLOW_MIN_THICKNESS) {
    return null;
  }
  if (!hollowInteriorExists(modelSpaceBrush, thickness)) {
    return null;
  }
  return hollowWallsCollect(instance, modelSpaceBrush, thickness);
}

/**
 * Returns whether the brush shrunk by the thickness still closes.
 *
 * @param modelSpaceBrush Brush geometry in model space.
 * @param thickness Wall thickness.
 * @returns True when an interior solid exists.
 */
function hollowInteriorExists(modelSpaceBrush: SolidBrush, thickness: number): boolean {
  const interiorCuts = modelSpaceBrush.planes.map((plane) => hollowInteriorPlane(plane, thickness));
  return SolidHalfspaceIntersection.build(modelSpaceBrush, interiorCuts) !== null;
}

/**
 * Collects the wall of every brush face.
 *
 * @param instance Brush instance providing face surfaces.
 * @param modelSpaceBrush Brush geometry in model space.
 * @param thickness Wall thickness.
 * @returns Built walls (degenerate walls are skipped).
 */
function hollowWallsCollect(
  instance: SolidBrushInstance,
  modelSpaceBrush: SolidBrush,
  thickness: number,
): HollowWallBuild[] {
  const walls: HollowWallBuild[] = [];
  for (let faceIndex = 0; faceIndex < modelSpaceBrush.faces.length; faceIndex += 1) {
    const wall = hollowWallBuild(instance, modelSpaceBrush, thickness, faceIndex);
    if (wall) {
      walls.push(wall);
    }
  }
  return walls;
}

/**
 * Builds the wall of one brush face.
 *
 * @param instance Brush instance providing face surfaces.
 * @param modelSpaceBrush Brush geometry in model space.
 * @param thickness Wall thickness.
 * @param faceIndex Face the wall wraps.
 * @returns Wall, or null when the band closes into no solid.
 */
function hollowWallBuild(
  instance: SolidBrushInstance,
  modelSpaceBrush: SolidBrush,
  thickness: number,
  faceIndex: number,
): HollowWallBuild | null {
  const cuts = hollowWallCutsBuild(modelSpaceBrush, thickness, faceIndex);
  const wallBrush = SolidHalfspaceIntersection.build(modelSpaceBrush, cuts);
  if (!wallBrush) {
    return null;
  }
  const center = hollowPointsCenter(wallBrush.vertices);
  const piece = hollowPieceBuild(wallBrush, center);
  if (!piece) {
    return null;
  }
  return {
    piece,
    surfaces: hollowWallSurfacesBuild(instance, modelSpaceBrush, wallBrush, center),
    sourceFaceIndex: faceIndex,
  };
}

/**
 * Builds the cut planes of one wall: the face's inward plane plus the inward
 * planes of every earlier face so walls do not overlap.
 *
 * @param modelSpaceBrush Brush geometry in model space.
 * @param thickness Wall thickness.
 * @param faceIndex Face the wall wraps.
 * @returns Outward cut planes.
 */
function hollowWallCutsBuild(modelSpaceBrush: SolidBrush, thickness: number, faceIndex: number): SolidPlane[] {
  const cuts: SolidPlane[] = [];
  for (let index = 0; index < faceIndex; index += 1) {
    const plane = modelSpaceBrush.planes[index];
    if (plane) {
      cuts.push(hollowInteriorPlane(plane, thickness));
    }
  }
  const facePlane = modelSpaceBrush.planes[faceIndex];
  if (facePlane) {
    cuts.push(hollowBandCut(facePlane, thickness));
  }
  return cuts;
}

/**
 * Returns the inward-offset plane of one face.
 *
 * @param plane Outward face plane.
 * @param thickness Wall thickness.
 * @returns Plane moved inward by the thickness.
 */
function hollowInteriorPlane(plane: SolidPlane, thickness: number): SolidPlane {
  return new SolidPlane(plane.normal.clone(), plane.offset + thickness);
}

/**
 * Returns the cut plane that keeps only the band outside one face's inward
 * plane.
 *
 * @param plane Outward face plane.
 * @param thickness Wall thickness.
 * @returns Cut plane with flipped normal.
 */
function hollowBandCut(plane: SolidPlane, thickness: number): SolidPlane {
  return new SolidPlane(plane.normal.clone().negate(), -(plane.offset + thickness));
}

/**
 * Builds a centered piece from a wall brush.
 *
 * @param wallBrush Wall geometry in model space.
 * @param center Wall center in model space.
 * @returns Centered piece, or null when the hull cannot close.
 */
function hollowPieceBuild(wallBrush: SolidBrush, center: THREE.Vector3): SolidShapeBrushPiece | null {
  const localPoints = wallBrush.vertices.map((vertex) => vertex.clone().sub(center));
  const topology = solidHullBrushFromPoints(localPoints);
  if (!topology) {
    return null;
  }
  return { topology, position: center.clone(), rotation: new THREE.Euler() };
}

/**
 * Builds the surfaces of one wall's faces.
 *
 * @param instance Brush instance providing face surfaces.
 * @param modelSpaceBrush Brush geometry in model space.
 * @param wallBrush Wall geometry in model space.
 * @param center Wall center in model space.
 * @returns One surface per wall face.
 */
function hollowWallSurfacesBuild(
  instance: SolidBrushInstance,
  modelSpaceBrush: SolidBrush,
  wallBrush: SolidBrush,
  center: THREE.Vector3,
): FaceSurfaceDescription[] {
  const sources = hollowSourceFacesBuild(instance, modelSpaceBrush, center);
  return wallBrush.faces.map((face) => {
    const loop = wallBrush.getFaceVertices(face).map((point) => point.sub(center));
    const surface = solidBrushHullMatchSurface(loop, sources);
    return surface ?? hollowFallbackSurface(instance);
  });
}

/**
 * Builds source faces in model space for surface matching.
 *
 * @param instance Brush instance providing face surfaces.
 * @param modelSpaceBrush Brush geometry in model space.
 * @param center Wall center in model space.
 * @returns Source faces with the piece-local to model translation.
 */
function hollowSourceFacesBuild(
  instance: SolidBrushInstance,
  modelSpaceBrush: SolidBrush,
  center: THREE.Vector3,
): SolidBrushHullSourceFace[] {
  const hullToSource = new THREE.Matrix4().makeTranslation(center.x, center.y, center.z);
  const sources: SolidBrushHullSourceFace[] = [];
  for (let index = 0; index < modelSpaceBrush.faces.length; index += 1) {
    hollowSourceFacePush(sources, instance, modelSpaceBrush, index, hullToSource);
  }
  return sources;
}

/**
 * Appends one source face.
 *
 * @param sources Source accumulator.
 * @param instance Brush instance providing face surfaces.
 * @param modelSpaceBrush Brush geometry in model space.
 * @param index Face index.
 * @param hullToSource Piece-local to model translation.
 */
function hollowSourceFacePush(
  sources: SolidBrushHullSourceFace[],
  instance: SolidBrushInstance,
  modelSpaceBrush: SolidBrush,
  index: number,
  hullToSource: THREE.Matrix4,
): void {
  const face = modelSpaceBrush.faces[index];
  const plane = modelSpaceBrush.planes[index];
  if (!face || !plane) {
    return;
  }
  sources.push({
    plane: plane.clone(),
    centroid: hollowPointsCenter(modelSpaceBrush.getFaceVertices(face)),
    surface: instance.getFaceSurface(index),
    hullToSource: hullToSource.clone(),
  });
}

/**
 * Builds the fallback surface of unmatched wall faces.
 *
 * @param instance Brush instance providing the default surface.
 * @returns Cloned default surface.
 */
function hollowFallbackSurface(instance: SolidBrushInstance): FaceSurfaceDescription {
  return instance.getFaceSurface(0);
}

/**
 * Returns the average of a point set.
 *
 * @param points Points to average.
 * @returns New center point.
 */
function hollowPointsCenter(points: readonly THREE.Vector3[]): THREE.Vector3 {
  const center = new THREE.Vector3();
  for (const point of points) {
    center.add(point);
  }
  return points.length > 0 ? center.divideScalar(points.length) : center;
}
