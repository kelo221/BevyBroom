import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ShapeDrawShapeStairs } from '@/tools/shape_draw/shapes/shape_draw_shape_stairs.js';
import { ShapeDrawShapeCylinder } from '@/tools/shape_draw/shapes/shape_draw_shape_cylinder.js';
import { SurfaceUvMatrix } from '@/texture/uv_matrix/surface_uv_matrix.js';
import type { FaceSurfaceDescription } from '@/texture/uv_matrix/face_surface_description.js';
import {
  shapeDrawSurfaceTestBrushAt,
  shapeDrawSurfaceTestBrushes,
  shapeDrawSurfaceTestFaceAlong,
  shapeDrawSurfaceTestFaceCentroid,
  shapeDrawSurfaceTestSceneCreate,
  shapeDrawSurfaceTestUvAt,
  type ShapeDrawSurfaceTestFace,
  type ShapeDrawSurfaceTestScene,
} from './shape_draw_surface_test_scene.js';

const SIDE_TEXTURE_ID = 'carry_side.png';
const TREAD_TEXTURE_ID = 'carry_tread.png';
const WALL_TEXTURE_ID = 'carry_wall.png';
const UP = new THREE.Vector3(0, 1, 0);
const LATERAL = new THREE.Vector3(0, 0, 1);

/**
 * Writes a recognisable surface with an offset, rotation and uneven scale on a face.
 *
 * @param face Face receiving the surface.
 * @param textureId Texture of the surface.
 * @returns Surface written.
 */
function faceSurfaceAuthor(face: ShapeDrawSurfaceTestFace, textureId: string): FaceSurfaceDescription {
  const surface: FaceSurfaceDescription = {
    textureId,
    uv: SurfaceUvMatrix.fromTrs(
      new THREE.Vector2(0.3, 0.1),
      face.brush.faceNormalLocal(face.faceIndex),
      15,
      0.5,
      2,
    ),
  };
  face.brush.setFaceSurface(face.faceIndex, surface);
  return surface;
}

/**
 * Draws stairs four steps high into a 4 x 2 x 1 bounds.
 *
 * @returns Scene around the stairs group.
 */
function stairsSceneCreate(): ShapeDrawSurfaceTestScene {
  const bounds = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(4, 2, 1));
  return shapeDrawSurfaceTestSceneCreate(new ShapeDrawShapeStairs(), { stepHeight: 0.5 }, bounds);
}

/**
 * Returns the texture on the lateral face of the first stairs piece.
 *
 * @param scene Stairs scene.
 * @returns Texture id.
 */
function firstPieceLateralTexture(scene: ShapeDrawSurfaceTestScene): string {
  const brush = shapeDrawSurfaceTestBrushAt(scene, 0);
  return brush.getSurfaceTextureId(shapeDrawSurfaceTestFaceAlong(brush, LATERAL).faceIndex);
}

/**
 * Returns the outward wall face of a cylinder piece around a vertical axis.
 *
 * @param scene Cylinder scene.
 * @param pieceIndex Piece index.
 * @returns Face pointing away from the cylinder axis.
 */
function cylinderWallFace(scene: ShapeDrawSurfaceTestScene, pieceIndex: number): ShapeDrawSurfaceTestFace {
  const brush = shapeDrawSurfaceTestBrushAt(scene, pieceIndex);
  const outward = brush.getModelSpaceBounds().getCenter(new THREE.Vector3()).setY(0).normalize();
  return shapeDrawSurfaceTestFaceAlong(brush, outward);
}

/** Proves shape regeneration carries per-face surfaces onto the new pieces. */
describe('ShapeDrawSurfaceCarry', () => {
  it('keeps a lateral face texture and its world-space UVs when the steps change', () => {
    const scene = stairsSceneCreate();
    const firstStep = shapeDrawSurfaceTestBrushAt(scene, 0);
    const oldSurface = faceSurfaceAuthor(shapeDrawSurfaceTestFaceAlong(firstStep, LATERAL), SIDE_TEXTURE_ID);
    const oldModelMatrix = firstStep.getModelSpaceMatrix().clone();
    expect(scene.handler.groupRebuild(scene.group, { stepHeight: 0.25 })).toBe(true);
    const newStep = shapeDrawSurfaceTestBrushAt(scene, 0);
    const newFace = shapeDrawSurfaceTestFaceAlong(newStep, LATERAL);
    const newSurface = newStep.getFaceSurface(newFace.faceIndex);
    expect(newSurface.textureId).toBe(SIDE_TEXTURE_ID);
    const samplePoint = shapeDrawSurfaceTestFaceCentroid(newFace);
    const oldUv = shapeDrawSurfaceTestUvAt(oldSurface, oldModelMatrix, samplePoint);
    const newUv = shapeDrawSurfaceTestUvAt(newSurface, newStep.getModelSpaceMatrix(), samplePoint);
    expect(newUv.u).toBeCloseTo(oldUv.u, 6);
    expect(newUv.v).toBeCloseTo(oldUv.v, 6);
  });

  it('gives added steps the surfaces of the last old step', () => {
    const scene = stairsSceneCreate();
    const oldCount = shapeDrawSurfaceTestBrushes(scene).length;
    const lastStep = shapeDrawSurfaceTestBrushAt(scene, -1);
    faceSurfaceAuthor(shapeDrawSurfaceTestFaceAlong(lastStep, UP), TREAD_TEXTURE_ID);
    scene.handler.groupRebuild(scene.group, { stepHeight: 0.25 });
    const newBrushes = shapeDrawSurfaceTestBrushes(scene);
    expect(newBrushes.length).toBeGreaterThan(oldCount);
    newBrushes.forEach((brush, pieceIndex) => {
      const tread = shapeDrawSurfaceTestFaceAlong(brush, UP);
      const expectsCustom = pieceIndex >= oldCount - 1;
      expect(brush.getSurfaceTextureId(tread.faceIndex) === TREAD_TEXTURE_ID).toBe(expectsCustom);
    });
  });

  it('restores the old surfaces on undo and carries them again on redo', () => {
    const scene = stairsSceneCreate();
    const firstStep = shapeDrawSurfaceTestBrushAt(scene, 0);
    faceSurfaceAuthor(shapeDrawSurfaceTestFaceAlong(firstStep, LATERAL), SIDE_TEXTURE_ID);
    scene.handler.groupRebuild(scene.group, { stepHeight: 1 });
    expect(firstPieceLateralTexture(scene)).toBe(SIDE_TEXTURE_ID);
    scene.commandStack.undo();
    expect(shapeDrawSurfaceTestBrushAt(scene, 0)).toBe(firstStep);
    expect(firstPieceLateralTexture(scene)).toBe(SIDE_TEXTURE_ID);
    scene.commandStack.redo();
    expect(shapeDrawSurfaceTestBrushAt(scene, 0)).not.toBe(firstStep);
    expect(firstPieceLateralTexture(scene)).toBe(SIDE_TEXTURE_ID);
  });

  it('keeps hollow cylinder wall textures when the side count changes', () => {
    const bounds = new THREE.Box3(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 2, 1));
    const hollow = { hollow: 'on', wallThickness: 0.2 };
    const scene = shapeDrawSurfaceTestSceneCreate(new ShapeDrawShapeCylinder(), { sides: 6, ...hollow }, bounds);
    const oldCount = shapeDrawSurfaceTestBrushes(scene).length;
    for (let pieceIndex = 0; pieceIndex < oldCount; pieceIndex++) {
      faceSurfaceAuthor(cylinderWallFace(scene, pieceIndex), WALL_TEXTURE_ID);
    }
    scene.handler.groupRebuild(scene.group, { sides: 9, ...hollow });
    const newCount = shapeDrawSurfaceTestBrushes(scene).length;
    expect(newCount).toBeGreaterThan(oldCount);
    for (let pieceIndex = 0; pieceIndex < newCount; pieceIndex++) {
      const wall = cylinderWallFace(scene, pieceIndex);
      expect(wall.brush.getSurfaceTextureId(wall.faceIndex)).toBe(WALL_TEXTURE_ID);
    }
  });
});
