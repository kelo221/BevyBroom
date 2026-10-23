import * as THREE from 'three';
import { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import type { SolidBrushHullSourceFace } from '@/tools/hull/solid_brush_hull_surface.js';

/** One brush face chosen for a convex merge in face mode. */
export interface ConvexMergeFacePick {
  /** Brush instance owning the face. */
  instance: SolidBrushInstance;
  /** Face index on the brush. */
  faceIndex: number;
}

/** World points and source faces gathered for one convex merge. */
export interface ConvexMergePointSet {
  /** World-space face corner points. */
  worldPoints: THREE.Vector3[];
  /** Authored faces in model-local space for surface matching. */
  sources: SolidBrushHullSourceFace[];
  /** Model the merged brush joins. */
  model: SolidModel;
}

/**
 * Gathers the world corner points of a solid result face selection.
 *
 * @param picks Selected brush faces in selection order.
 * @returns Point set, or null when no solid face resolves.
 */
export function convexMergeFacePointsBuild(picks: readonly ConvexMergeFacePick[]): ConvexMergePointSet | null {
  const model = convexMergeModelResolve(picks);
  if (!model) {
    return null;
  }
  model.root.updateWorldMatrix(true, false);
  const worldPoints: THREE.Vector3[] = [];
  const sources: SolidBrushHullSourceFace[] = [];
  for (const pick of picks) {
    convexMergeFacePush(worldPoints, sources, pick, model);
  }
  if (worldPoints.length < 4) {
    return null;
  }
  return { worldPoints, sources, model };
}

/**
 * Resolves the common solid model of the picked faces.
 *
 * @param picks Selected brush faces.
 * @returns Model of the first pick, or null.
 */
function convexMergeModelResolve(picks: readonly ConvexMergeFacePick[]): SolidModel | null {
  const first = picks[0];
  const mesh = first ? first.instance.mesh : null;
  return mesh ? SolidModel.fromObject(mesh) : null;
}

/**
 * Appends the world points and model-space source of one picked face.
 *
 * @param worldPoints World point accumulator.
 * @param sources Source face accumulator.
 * @param pick Selected brush face.
 * @param model Model the merge joins.
 */
function convexMergeFacePush(
  worldPoints: THREE.Vector3[],
  sources: SolidBrushHullSourceFace[],
  pick: ConvexMergeFacePick,
  model: SolidModel,
): void {
  const mesh = pick.instance.mesh;
  const face = pick.instance.brush.faces[pick.faceIndex];
  if (!mesh || !face) {
    return;
  }
  mesh.updateWorldMatrix(true, false);
  const modelWorldInverse = model.root.matrixWorld.clone().invert();
  const toModel = modelWorldInverse.multiply(mesh.matrixWorld);
  const loop = pick.instance.brush.getFaceVertices(face);
  for (const point of loop) {
    worldPoints.push(point.clone().applyMatrix4(mesh.matrixWorld));
  }
  convexMergeSourcePush(sources, pick, toModel, loop);
}

/**
 * Appends the model-space source face of one picked face.
 *
 * @param sources Source face accumulator.
 * @param pick Selected brush face.
 * @param toModel Matrix mapping brush-local points into the model.
 * @param loop Brush-local face loop.
 */
function convexMergeSourcePush(
  sources: SolidBrushHullSourceFace[],
  pick: ConvexMergeFacePick,
  toModel: THREE.Matrix4,
  loop: readonly THREE.Vector3[],
): void {
  const plane = pick.instance.brush.planes[pick.faceIndex];
  if (!plane) {
    return;
  }
  const centroid = new THREE.Vector3();
  for (const point of loop) {
    centroid.add(point);
  }
  centroid.multiplyScalar(1 / Math.max(loop.length, 1)).applyMatrix4(toModel);
  sources.push({
    plane: plane.applyMatrix4(toModel),
    centroid,
    surface: pick.instance.getFaceSurface(pick.faceIndex),
    hullToSource: toModel.clone().invert(),
  });
}
