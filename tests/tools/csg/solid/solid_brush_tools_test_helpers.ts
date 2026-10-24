import * as THREE from 'three';
import { SolidModel } from '@/solid/model/solid_model.js';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';
import { solidBrushesWorldVertexBounds } from '@/solid/model/solid_brush_world_bounds.js';

/** Tolerance used when comparing rebuilt brush coordinates. */
export const SOLID_BRUSH_TOOLS_TEST_EPSILON = 1e-4;

/**
 * Adds an additive box brush with given edge lengths centered on a point.
 *
 * @param model Model receiving the brush.
 * @param edges Edge lengths along X, Y and Z.
 * @param center World center of the box.
 * @returns Created brush instance with its pose applied.
 */
export function solidBrushToolsTestBoxAdd(
  model: SolidModel,
  edges: THREE.Vector3,
  center: THREE.Vector3,
): SolidBrushInstance {
  const brush = model.addBoxBrush(edges.clone(), SolidOperation.Additive, model.root, false);
  brush.position.copy(center);
  brush.pushTransformToMesh();
  model.root.updateWorldMatrix(true, true);
  return brush;
}

/**
 * Returns the world-space vertices of one brush.
 *
 * @param brush Brush instance.
 * @returns World vertices.
 */
export function solidBrushToolsTestWorldVertices(brush: SolidBrushInstance): THREE.Vector3[] {
  const model = brush.mesh ? SolidModel.fromObject(brush.mesh) : null;
  const modelBrush = brush.getModelSpaceBrush();
  if (!model) {
    return modelBrush.vertices.map((vertex) => vertex.clone());
  }
  model.root.updateWorldMatrix(true, false);
  return modelBrush.vertices.map((vertex) => vertex.clone().applyMatrix4(model.root.matrixWorld));
}

/**
 * Returns the world bounds of several brushes.
 *
 * @param brushes Brush instances.
 * @returns World bounds of every vertex.
 */
export function solidBrushToolsTestWorldBounds(brushes: readonly SolidBrushInstance[]): THREE.Box3 {
  return solidBrushesWorldVertexBounds(brushes);
}

/**
 * Returns whether two boxes match within the test tolerance.
 *
 * @param first First box.
 * @param second Second box.
 * @returns True when both corners match.
 */
export function solidBrushToolsTestBoundsMatch(first: THREE.Box3, second: THREE.Box3): boolean {
  return (
    first.min.distanceTo(second.min) <= SOLID_BRUSH_TOOLS_TEST_EPSILON &&
    first.max.distanceTo(second.max) <= SOLID_BRUSH_TOOLS_TEST_EPSILON
  );
}

/**
 * Returns the brush meshes of a list of brush instances.
 *
 * @param brushes Brush instances.
 * @returns Preview meshes of brushes that have one.
 */
export function solidBrushToolsTestMeshes(brushes: readonly SolidBrushInstance[]): THREE.Mesh[] {
  return brushes.flatMap((brush) => (brush.mesh ? [brush.mesh] : []));
}

/**
 * Returns the sorted world vertex keys of a brush, rounded to the tolerance.
 *
 * @param brush Brush instance.
 * @returns Sorted coordinate keys usable for set comparisons.
 */
export function solidBrushToolsTestVertexKeys(brush: SolidBrushInstance): string[] {
  const digits = 3;
  return solidBrushToolsTestWorldVertices(brush)
    .map((vertex) => `${vertex.x.toFixed(digits)},${vertex.y.toFixed(digits)},${vertex.z.toFixed(digits)}`)
    .map((key) => key.replaceAll('-0.000', '0.000'))
    .sort();
}
