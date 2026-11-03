import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ShapeDrawShapeStairs } from '@/tools/shape_draw/shapes/shape_draw_shape_stairs.js';
import { ShapeDrawShapeCylinder } from '@/tools/shape_draw/shapes/shape_draw_shape_cylinder.js';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import {
  shapeDrawSurfaceTestBrushes,
  shapeDrawSurfaceTestFaceAlong,
  shapeDrawSurfaceTestSceneCreate,
  shapeDrawSurfaceTestUvAt,
  type ShapeDrawSurfaceTestFace,
  type ShapeDrawSurfaceTestScene,
} from './shape_draw_surface_test_scene.js';

const LATERAL = new THREE.Vector3(0, 0, 1);
const UP = new THREE.Vector3(0, 1, 0);

/**
 * Draws stairs into a 4 x 2 x 1 bounds.
 *
 * @param stepHeight Step height of the draw.
 * @returns Scene around the stairs group.
 */
function stairsSceneCreate(stepHeight: number): ShapeDrawSurfaceTestScene {
  const bounds = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(4, 2, 1));
  return shapeDrawSurfaceTestSceneCreate(new ShapeDrawShapeStairs(), { stepHeight }, bounds);
}

/**
 * Projects a model-space point through the surface a brush face shows.
 *
 * @param face Located face.
 * @param modelPoint Model-space point on the face.
 * @returns UV pair at that point.
 */
function faceUvAt(face: ShapeDrawSurfaceTestFace, modelPoint: THREE.Vector3): { u: number; v: number } {
  const surface = face.brush.getFaceSurface(face.faceIndex);
  return shapeDrawSurfaceTestUvAt(surface, face.brush.getModelSpaceMatrix(), modelPoint);
}

/**
 * Returns a model-space point on the seam two neighbouring stair steps share on
 * their lateral side.
 *
 * @param left Step nearer the stairs start.
 * @param right Next step.
 * @returns Point on both lateral faces.
 */
function stairsLateralSeamPoint(left: SolidBrushInstance, right: SolidBrushInstance): THREE.Vector3 {
  const leftBounds = left.getModelSpaceBounds();
  const rightBounds = right.getModelSpaceBounds();
  const sharedTop = Math.min(leftBounds.max.y, rightBounds.max.y);
  return new THREE.Vector3(leftBounds.max.x, (leftBounds.min.y + sharedTop) / 2, leftBounds.max.z);
}

/**
 * Lists the model-space corners of one brush face.
 *
 * @param face Located face.
 * @returns Corner points in model space.
 */
function faceCornersModel(face: ShapeDrawSurfaceTestFace): THREE.Vector3[] {
  const brushFace = face.brush.brush.faces[face.faceIndex];
  const matrix = face.brush.getModelSpaceMatrix();
  return brushFace
    ? face.brush.brush.getFaceVertices(brushFace).map((vertex) => vertex.clone().applyMatrix4(matrix))
    : [];
}

/**
 * Asserts two faces show the same texture coordinates at a shared point.
 *
 * @param first One face.
 * @param second Other face.
 * @param modelPoint Model-space point on both faces.
 */
function uvContinuityExpect(
  first: ShapeDrawSurfaceTestFace,
  second: ShapeDrawSurfaceTestFace,
  modelPoint: THREE.Vector3,
): void {
  const firstUv = faceUvAt(first, modelPoint);
  const secondUv = faceUvAt(second, modelPoint);
  expect(secondUv.u).toBeCloseTo(firstUv.u, 6);
  expect(secondUv.v).toBeCloseTo(firstUv.v, 6);
}

/**
 * Asserts every pair of neighbouring stair steps shows one continuous texture
 * across their shared lateral seam.
 *
 * @param scene Stairs scene.
 */
function stairsLateralSeamsContinuousExpect(scene: ShapeDrawSurfaceTestScene): void {
  const steps = shapeDrawSurfaceTestBrushes(scene);
  expect(steps.length).toBeGreaterThan(1);
  steps.slice(1).forEach((right, order) => {
    const left = steps[order];
    if (!left) {
      throw new Error('missing step');
    }
    const seamPoint = stairsLateralSeamPoint(left, right);
    uvContinuityExpect(
      shapeDrawSurfaceTestFaceAlong(left, LATERAL),
      shapeDrawSurfaceTestFaceAlong(right, LATERAL),
      seamPoint,
    );
  });
}

/** Proves shape pieces share one texture grid anchored to the model origin. */
describe('ShapeDrawSurfaceAnchor', () => {
  it('lines up the default texture across every stair seam on a fresh draw', () => {
    stairsLateralSeamsContinuousExpect(stairsSceneCreate(0.25));
  });

  it('keeps the stair seams continuous after a regenerate', () => {
    const scene = stairsSceneCreate(0.25);
    expect(scene.handler.groupRebuild(scene.group, { stepHeight: 0.5 })).toBe(true);
    stairsLateralSeamsContinuousExpect(scene);
  });

  it('lines up the top faces of neighbouring cylinder wedges at their shared corners', () => {
    const bounds = new THREE.Box3(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 2, 1));
    const scene = shapeDrawSurfaceTestSceneCreate(new ShapeDrawShapeCylinder(), { sides: 7 }, bounds);
    const tops = shapeDrawSurfaceTestBrushes(scene).map((brush) => shapeDrawSurfaceTestFaceAlong(brush, UP));
    let sharedCornerCount = 0;
    tops.forEach((top, order) => {
      const next = tops[(order + 1) % tops.length];
      const nextCorners = next ? faceCornersModel(next) : [];
      faceCornersModel(top)
        .filter((corner) => nextCorners.some((other) => other.distanceTo(corner) < 1e-6))
        .forEach((corner) => {
          sharedCornerCount += 1;
          if (next) uvContinuityExpect(top, next, corner);
        });
    });
    expect(sharedCornerCount).toBeGreaterThanOrEqual(tops.length);
  });
});
