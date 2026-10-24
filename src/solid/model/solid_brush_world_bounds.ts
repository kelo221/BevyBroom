import * as THREE from 'three';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import { SolidModel } from '@/solid/model/solid_model.js';

const scratchQuaternion = new THREE.Quaternion();
const scratchMatrix = new THREE.Matrix4();
const scratchBox = new THREE.Box3();

/**
 * Composes a local TRS matrix for a brush instance.
 *
 * @param brush Brush instance with position/rotation/scale.
 * @returns Independent matrix.
 */
export function brushLocalMatrix(brush: SolidBrushInstance): THREE.Matrix4 {
  scratchQuaternion.setFromEuler(brush.rotation);
  return scratchMatrix.compose(brush.position, scratchQuaternion, brush.scale).clone();
}

/**
 * Computes world-space AABB for a brush under its solid model.
 *
 * @param model Owning solid model.
 * @param brush Brush instance.
 * @returns World bounds box.
 */
export function computeBrushWorldBounds(model: SolidModel, brush: SolidBrushInstance): THREE.Box3 {
  brush.pullTransformFromMesh();
  model.root.updateMatrixWorld(true);
  const localBounds = brush.brush.computeLocalBounds();
  if (localBounds.isEmpty()) return new THREE.Box3();
  const localMatrix = brushLocalMatrix(brush);
  const worldMatrix = new THREE.Matrix4().multiplyMatrices(model.root.matrixWorld, localMatrix);
  scratchBox.copy(localBounds).applyMatrix4(worldMatrix);
  return scratchBox.clone();
}

/**
 * Computes combined world bounds for all brushes in a solid model.
 *
 * @param model Solid model.
 * @returns Combined world box or empty box.
 */
export function computeModelWorldBounds(model: SolidModel): THREE.Box3 {
  const combined = new THREE.Box3();
  for (const brush of model.getBrushes()) {
    const brushBounds = computeBrushWorldBounds(model, brush);
    if (!brushBounds.isEmpty()) combined.union(brushBounds);
  }
  return combined;
}

/**
 * Builds the world bounds of every vertex of several solid brushes, exact for
 * rotated brushes.
 *
 * @param brushes Brush instances.
 * @returns World vertex bounds, empty when no brush has vertices.
 */
export function solidBrushesWorldVertexBounds(brushes: readonly SolidBrushInstance[]): THREE.Box3 {
  const bounds = new THREE.Box3();
  for (const brush of brushes) {
    solidBrushWorldVertexBoundsExpand(bounds, brush);
  }
  return bounds;
}

/**
 * Grows bounds by the world vertices of one brush.
 *
 * @param bounds Bounds accumulator.
 * @param brush Brush instance.
 */
function solidBrushWorldVertexBoundsExpand(bounds: THREE.Box3, brush: SolidBrushInstance): void {
  const modelBrush = brush.getModelSpaceBrush();
  const model = brush.mesh ? SolidModel.fromObject(brush.mesh) : null;
  if (!model) {
    modelBrush.vertices.forEach((vertex) => bounds.expandByPoint(vertex));
    return;
  }
  model.root.updateWorldMatrix(true, false);
  for (const vertex of modelBrush.vertices) {
    bounds.expandByPoint(vertex.clone().applyMatrix4(model.root.matrixWorld));
  }
}
