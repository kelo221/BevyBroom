import * as THREE from 'three';
import type { TextureApplyTarget } from '@/texture/uv/face_texture_applier.js';
import { FaceUvOperationContext, type FaceUvTextureSizePixels } from './face_uv_operation_context.js';
import {
  faceUvOperationContextFromTarget,
  type FaceUvCameraDirections,
  type FaceUvTargetContextFactory,
} from './face_uv_operation_context_factory.js';

/**
 * Creates a `FaceUvTargetContextFactory` that treats all selected face regions
 * as a single combined vertex cloud ("Treat as one" in Hammer++ Face Edit
 * Sheet) so Fit and Justify span seamlessly across multiple selected faces.
 *
 * @param targets All selected face targets.
 * @param cameraDirections Optional camera right/up directions.
 * @param textureSizePixels Optional texture dimensions.
 * @returns Context factory returning a combined-bounds context per target.
 */
export function createCombinedWorldPolygonTargetContextFactory(
  targets: readonly TextureApplyTarget[],
  cameraDirections: FaceUvCameraDirections | null,
  textureSizePixels: FaceUvTextureSizePixels | null = null,
): FaceUvTargetContextFactory {
  if (targets.length <= 1) {
    return (target) => faceUvOperationContextFromTarget(target, cameraDirections, textureSizePixels);
  }
  const combinedVertices = collectCombinedTargetVertices(targets, cameraDirections, textureSizePixels);
  if (combinedVertices.length < 3) {
    return (target) => faceUvOperationContextFromTarget(target, cameraDirections, textureSizePixels);
  }
  return (target) => buildTargetCombinedContext(target, combinedVertices, cameraDirections, textureSizePixels);
}

/**
 * Collects the union of world polygon vertices across all targets.
 *
 * @param targets Selected face targets.
 * @param cameraDirections Optional camera directions.
 * @param textureSizePixels Optional texture dimensions.
 * @returns Combined world vertices.
 */
function collectCombinedTargetVertices(
  targets: readonly TextureApplyTarget[],
  cameraDirections: FaceUvCameraDirections | null,
  textureSizePixels: FaceUvTextureSizePixels | null,
): THREE.Vector3[] {
  const allVertices: THREE.Vector3[] = [];
  for (const target of targets) {
    const ctx = faceUvOperationContextFromTarget(target, cameraDirections, textureSizePixels);
    if (ctx) {
      for (const vertex of ctx.vertices) {
        allVertices.push(vertex.clone());
      }
    }
  }
  return allVertices;
}

/**
 * Builds a `FaceUvOperationContext` for one target using the combined vertex
 * cloud while preserving the target's own face normal.
 *
 * @param target Target face region.
 * @param combinedVertices Union of world vertices across all targets.
 * @param cameraDirections Optional camera directions.
 * @param textureSizePixels Optional texture dimensions.
 * @returns Combined operation context, or null.
 */
function buildTargetCombinedContext(
  target: TextureApplyTarget,
  combinedVertices: readonly THREE.Vector3[],
  cameraDirections: FaceUvCameraDirections | null,
  textureSizePixels: FaceUvTextureSizePixels | null,
): FaceUvOperationContext | null {
  const own = faceUvOperationContextFromTarget(target, cameraDirections, textureSizePixels);
  if (!own) {
    return null;
  }
  return new FaceUvOperationContext({
    vertices: [...combinedVertices],
    faceNormal: own.faceNormal,
    ...(textureSizePixels ? { textureSizePixels } : {}),
    ...(cameraDirections ? { cameraRight: cameraDirections.right, cameraUp: cameraDirections.up } : {}),
  });
}
