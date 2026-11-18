import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { CollisionModelPiece } from '@/level_export/collision/collision_model_result.js';
import {
  COLLISION_INVERTED_WORLD_MARGIN,
  CollisionSolidModelCollector,
} from '@/level_export/collision/collision_solid_model_collector.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';
import {
  type CollisionTestBrush,
  collisionTestGroupApply,
  collisionTestModelCreate,
  collisionTestPieceContains,
  collisionTestSamples,
} from './collision_test_models.js';

const outer = new THREE.Box3(new THREE.Vector3(-4, 0, -3), new THREE.Vector3(4, 3, 3));
const inner = new THREE.Box3(new THREE.Vector3(-3.5, 0.25, -2.5), new THREE.Vector3(3.5, 2.75, 2.5));
const SAMPLE_STEP = 0.5;

/**
 * Returns whether a point lies inside a box.
 *
 * @param box Box.
 * @param point Point.
 * @returns True when inside.
 */
function inside(box: THREE.Box3, point: THREE.Vector3): boolean {
  return box.containsPoint(point);
}

/**
 * Expects the pieces to cover exactly the points the predicate calls solid, and
 * every piece to be convex.
 *
 * @param pieces Collected pieces.
 * @param sampled Box to sample.
 * @param isSolid Expected solid test.
 */
function expectPiecesCover(
  pieces: readonly CollisionModelPiece[],
  sampled: THREE.Box3,
  isSolid: (point: THREE.Vector3) => boolean,
): void {
  const wrong = collisionTestSamples(sampled, SAMPLE_STEP).filter(
    (point) => pieces.some((piece) => collisionTestPieceContains(piece, point)) !== isSolid(point),
  );
  expect(wrong.map((point) => point.toArray())).toEqual([]);
  for (const piece of pieces) {
    const vertices = piece.vertices.map((vertex) => new THREE.Vector3(...vertex));
    expect(vertices.every((vertex) => collisionTestPieceContains(piece, vertex))).toBe(true);
  }
}

/**
 * Collects the pieces of a model built from boxes.
 *
 * @param brushes Boxes and operations.
 * @returns Pieces.
 */
function piecesOf(brushes: readonly CollisionTestBrush[]): CollisionModelPiece[] {
  return CollisionSolidModelCollector.collect(collisionTestModelCreate(brushes).root).pieces;
}

const sampled = outer.clone().expandByScalar(1);

/** Collision pieces are the convex parts of the final CSG result. */
describe('CollisionSolidModelCollector', () => {
  it('splits a box minus a smaller box into convex walls, floor and ceiling with nothing in the room', () => {
    const pieces = piecesOf([
      { box: outer, operation: SolidOperation.Additive },
      { box: inner, operation: SolidOperation.Subtractive },
    ]);
    expect(pieces.length).toBeGreaterThanOrEqual(6);
    expectPiecesCover(pieces, sampled, (point) => inside(outer, point) && !inside(inner, point));
  });

  it('carves overlapping subtractives and fills back in with a later additive', () => {
    const first = new THREE.Box3(new THREE.Vector3(-3, 0.5, -2), new THREE.Vector3(1, 2.5, 2));
    const second = new THREE.Box3(new THREE.Vector3(-1, 0.5, -1), new THREE.Vector3(3, 2.5, 1));
    const pillar = new THREE.Box3(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 3, 0.5));
    const pieces = piecesOf([
      { box: outer, operation: SolidOperation.Additive },
      { box: first, operation: SolidOperation.Subtractive },
      { box: second, operation: SolidOperation.Subtractive },
      { box: pillar, operation: SolidOperation.Additive },
    ]);
    expectPiecesCover(
      pieces,
      sampled,
      (point) => (inside(outer, point) && !inside(first, point) && !inside(second, point)) || inside(pillar, point),
    );
  });

  it('keeps only the common part of an intersecting brush', () => {
    const cutter = new THREE.Box3(new THREE.Vector3(-2, -1, -1), new THREE.Vector3(6, 2, 4));
    const pieces = piecesOf([
      { box: outer, operation: SolidOperation.Additive },
      { box: cutter, operation: SolidOperation.Intersecting },
    ]);
    expectPiecesCover(pieces, sampled, (point) => inside(outer, point) && inside(cutter, point));
  });

  it('subtracts a compound group as the union of its children', () => {
    const left = new THREE.Box3(new THREE.Vector3(-3, 0.5, -1), new THREE.Vector3(0.5, 2.5, 1));
    const right = new THREE.Box3(new THREE.Vector3(-0.5, 0.5, -2), new THREE.Vector3(3, 2.5, 0.5));
    const model = collisionTestModelCreate([
      { box: outer, operation: SolidOperation.Additive },
      { box: left, operation: SolidOperation.Additive },
      { box: right, operation: SolidOperation.Additive },
    ]);
    collisionTestGroupApply(model, [1, 2], SolidOperation.Subtractive);
    const pieces = CollisionSolidModelCollector.collect(model.root).pieces;
    expectPiecesCover(
      pieces,
      sampled,
      (point) => inside(outer, point) && !inside(left, point) && !inside(right, point),
    );
  });

  it('bounds an inverted world by the brushes and a margin', () => {
    const model = collisionTestModelCreate([{ box: inner, operation: SolidOperation.Subtractive }], true);
    const pieces = CollisionSolidModelCollector.collect(model.root).pieces;
    const bounds = inner.clone().expandByScalar(COLLISION_INVERTED_WORLD_MARGIN);
    expectPiecesCover(
      pieces,
      bounds.clone().expandByScalar(1),
      (point) => inside(bounds, point) && !inside(inner, point),
    );
  });

  it('gives each plane the texture of the face on it: outer faces the outer brush, room walls the carving brush', () => {
    const pieces = piecesOf([
      { box: outer, operation: SolidOperation.Additive, textureId: 'brick' },
      { box: inner, operation: SolidOperation.Subtractive, textureId: 'plaster' },
    ]);
    const roomCenter = inner.getCenter(new THREE.Vector3());
    const planes = pieces.flatMap((piece) => piece.planes);
    for (const plane of planes.filter((candidate) => candidate.texture === 'plaster')) {
      expect(new THREE.Vector3(...plane.normal).dot(roomCenter) - plane.distance).toBeGreaterThan(0);
    }
    for (const plane of planes.filter((candidate) => candidate.texture === 'brick')) {
      expect(new THREE.Vector3(...plane.normal).dot(roomCenter) - plane.distance).toBeLessThan(0);
    }
    expect(pieces.some((piece) => piece.planes.some((plane) => plane.texture === 'plaster'))).toBe(true);
    expect(pieces.some((piece) => piece.planes.some((plane) => plane.texture === 'brick'))).toBe(true);
  });

  it('places the pieces in world space under a moved and turned solid model', () => {
    const model = collisionTestModelCreate([{ box: outer, operation: SolidOperation.Additive }]);
    model.root.position.set(10, 2, -5);
    model.root.rotation.set(0, Math.PI / 3, 0);
    model.root.updateMatrixWorld(true);
    const pieces = CollisionSolidModelCollector.collect(model.root).pieces;
    const toLocal = model.root.matrixWorld.clone().invert();
    expectPiecesCover(pieces, outer.clone().applyMatrix4(model.root.matrixWorld).expandByScalar(1), (point) =>
      inside(outer, point.clone().applyMatrix4(toLocal)),
    );
  });
});
