import * as THREE from 'three';
import type { CollisionModelPiece } from '@/level_export/collision/collision_model_result.js';
import { SolidBrushFactory } from '@/solid/brush/solid_brush_factory.js';
import { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import { markAsSolidCsgGroup } from '@/solid/model/solid_group.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';

/** One brush of a test model: its box and operation. */
export interface CollisionTestBrush {
  readonly box: THREE.Box3;
  readonly operation: SolidOperation;
  readonly textureId?: string;
}

/**
 * Builds a compiled solid model from boxes, in order.
 *
 * @param brushes Boxes and operations.
 * @param invertedWorld True for an inverted world.
 * @returns The compiled model.
 */
export function collisionTestModelCreate(brushes: readonly CollisionTestBrush[], invertedWorld = false): SolidModel {
  const model = new SolidModel('Collision Test');
  brushes.forEach((entry, index) => {
    const instance = new SolidBrushInstance(
      `brush-${index}`,
      `Brush ${index}`,
      SolidBrushFactory.createBox(entry.box.min, entry.box.max),
      entry.operation,
    );
    if (entry.textureId !== undefined) {
      instance.surfaceTextureId = entry.textureId;
    }
    model.addBrushInstance(instance);
  });
  if (invertedWorld) {
    model.setInvertedWorld(true);
  }
  model.rebuild(true);
  model.root.updateMatrixWorld(true);
  return model;
}

/**
 * Moves the brushes with the given indices into one CSG group of a model and
 * recompiles it.
 *
 * @param model Compiled model.
 * @param brushIndices Indices of the grouped brushes.
 * @param operation Operation of the group.
 */
export function collisionTestGroupApply(
  model: SolidModel,
  brushIndices: readonly number[],
  operation: SolidOperation,
): void {
  const group = new THREE.Group();
  markAsSolidCsgGroup(group, operation);
  model.root.add(group);
  for (const index of brushIndices) {
    const mesh = model.findBrush(`brush-${index}`)?.mesh;
    if (mesh) {
      group.add(mesh);
    }
  }
  model.syncBrushOrderFromScene();
  model.markDirty();
  model.rebuild(true);
  model.root.updateMatrixWorld(true);
}

/**
 * Returns whether a point lies inside a convex piece.
 *
 * @param piece Piece record.
 * @param point World point.
 * @returns True when the point is behind every plane.
 */
export function collisionTestPieceContains(piece: CollisionModelPiece, point: THREE.Vector3): boolean {
  return piece.planes.every((plane) => new THREE.Vector3(...plane.normal).dot(point) - plane.distance <= 1e-5);
}

/**
 * Returns sample points on a grid inside a box, offset off the grid lines so
 * they never land on a face.
 *
 * @param box Sampled box.
 * @param step Grid step.
 * @returns Sample points.
 */
export function collisionTestSamples(box: THREE.Box3, step: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const offset = step * 0.37;
  for (let x = box.min.x + offset; x < box.max.x; x += step) {
    for (let y = box.min.y + offset; y < box.max.y; y += step) {
      for (let z = box.min.z + offset; z < box.max.z; z += step) {
        points.push(new THREE.Vector3(x, y, z));
      }
    }
  }
  return points;
}
