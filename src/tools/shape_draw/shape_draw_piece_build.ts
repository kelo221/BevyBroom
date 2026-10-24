import * as THREE from 'three';
import type { SolidModel } from '@/solid/model/solid_model.js';
import { solidHullBrushFromPoints } from '@/solid/algorithm/surface/solid_hull_brush.js';
import type { SolidShapeBrushPiece } from '@/solid/commands/brushes/command_solid_shape_brushes_add.js';

/** World point sets about to become brush pieces of a solid model. */
export interface ShapeDrawPieceBuildRequest {
  /** Solid model the pieces are posed for. */
  model: SolidModel;
  /** Convex point sets in world coordinates. */
  worldPieces: THREE.Vector3[][];
}

/**
 * Turns world point sets into centered convex brush pieces posed in model
 * space. Pieces whose hull cannot close are skipped.
 *
 * @param request Model and world pieces.
 * @returns Model-local brush pieces.
 */
export function shapeDrawPiecesBuildCreate(request: ShapeDrawPieceBuildRequest): SolidShapeBrushPiece[] {
  request.model.root.updateWorldMatrix(true, false);
  const pieces: SolidShapeBrushPiece[] = [];
  for (const worldPoints of request.worldPieces) {
    const modelLocalPoints = worldPoints.map((point) => request.model.root.worldToLocal(point.clone()));
    const piece = shapeDrawPieceFromPointsCreate(modelLocalPoints);
    if (piece) {
      pieces.push(piece);
    }
  }
  return pieces;
}

/**
 * Turns model-local point sets into centered convex brush pieces.
 *
 * @param modelLocalPieces Convex point sets in model space.
 * @returns Model-local brush pieces.
 */
export function shapeDrawPiecesFromPointsCreate(modelLocalPieces: THREE.Vector3[][]): SolidShapeBrushPiece[] {
  const pieces: SolidShapeBrushPiece[] = [];
  for (const points of modelLocalPieces) {
    const piece = shapeDrawPieceFromPointsCreate(points);
    if (piece) {
      pieces.push(piece);
    }
  }
  return pieces;
}

/**
 * Builds one centered convex brush piece from a point set. The topology is
 * expressed in the target space already, so the pose rotation stays identity
 * and only the center position moves it.
 *
 * @param points Convex point set.
 * @returns Centered brush piece, or null when the hull cannot close.
 */
function shapeDrawPieceFromPointsCreate(points: THREE.Vector3[]): SolidShapeBrushPiece | null {
  const center = shapeDrawPointsCenterCreate(points);
  const topology = solidHullBrushFromPoints(points.map((point) => point.clone().sub(center)));
  if (!topology) {
    return null;
  }
  return { topology, position: center, rotation: new THREE.Euler() };
}

/**
 * Returns the average of a point set.
 *
 * @param points Points to average.
 * @returns New center point.
 */
function shapeDrawPointsCenterCreate(points: THREE.Vector3[]): THREE.Vector3 {
  const center = new THREE.Vector3();
  for (const point of points) {
    center.add(point);
  }
  return points.length > 0 ? center.divideScalar(points.length) : center;
}
