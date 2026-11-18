import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CollisionMeshCollector } from '@/level_export/collision/mesh/collision_mesh_collector.js';
import { collisionTestPieceContains } from '../collision_test_models.js';
import { collisionTestBoxCornersWorld, collisionTestBoxMeshCreate } from './collision_mesh_test_boxes.js';

/** Size of the test box. */
const BOX_SIZE = new THREE.Vector3(2, 1, 3);

/**
 * Creates the turned test box.
 *
 * @returns Box mesh.
 */
function turnedBoxCreate(): THREE.Mesh {
  return collisionTestBoxMeshCreate({
    size: BOX_SIZE,
    position: new THREE.Vector3(3, 1.5, -2),
    rotation: new THREE.Euler(0.3, 0.7, -0.2),
    texture: 'textures/crate.png',
  });
}

/**
 * Plain content meshes become one convex piece when convex, else flagged
 * triangles.
 */
describe('CollisionMeshCollector', () => {
  it('turns a rotated Add > Box mesh into one piece that holds exactly its box', () => {
    const mesh = turnedBoxCreate();
    const corners = collisionTestBoxCornersWorld(mesh, BOX_SIZE);
    const collected = CollisionMeshCollector.collect(mesh);
    expect(collected.flagged).toEqual([]);
    expect(collected.pieces).toHaveLength(1);
    const piece = collected.pieces[0];
    if (!piece) throw new Error('missing piece');
    expect(piece.planes).toHaveLength(6);
    expect(piece.vertices).toHaveLength(8);
    corners.forEach((corner) => expect(collisionTestPieceContains(piece, corner)).toBe(true));
    const centre = new THREE.Vector3().setFromMatrixPosition(mesh.matrixWorld);
    corners.forEach((corner) => {
      const beyond = corner.clone().sub(centre).multiplyScalar(1.01).add(centre);
      expect(collisionTestPieceContains(piece, beyond)).toBe(false);
    });
    piece.vertices.forEach((vertex) =>
      expect(Math.min(...corners.map((corner) => corner.distanceTo(new THREE.Vector3(...vertex))))).toBeLessThan(1e-4),
    );
  });

  it('gives every plane of the piece the texture of its faces and no brush', () => {
    const piece = CollisionMeshCollector.collect(turnedBoxCreate()).pieces[0];
    expect(piece?.brush_id).toBe('');
    expect(piece?.brush_name).toBe('');
    expect(piece?.planes.every((plane) => plane.texture === 'textures/crate.png')).toBe(true);
  });

  it('flags a non-convex mesh as triangles', () => {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(1, 0.25, 6, 12), new THREE.MeshStandardMaterial());
    mesh.position.set(-4, 2, 1);
    mesh.updateMatrixWorld(true);
    const collected = CollisionMeshCollector.collect(mesh);
    expect(collected.pieces).toEqual([]);
    expect(collected.flagged).toHaveLength(1);
    expect(collected.flagged[0]?.reason).toBe('non_convex_mesh');
    expect(collected.flagged[0]?.triangles.length).toBeGreaterThan(0);
  });

  it('flags a flat mesh, which bounds no volume', () => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshStandardMaterial());
    mesh.updateMatrixWorld(true);
    const collected = CollisionMeshCollector.collect(mesh);
    expect(collected.pieces).toEqual([]);
    expect(collected.flagged[0]?.reason).toBe('non_convex_mesh');
  });

  it('flags a convex mesh with an open side, which bounds no closed volume', () => {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const index = geometry.getIndex();
    if (!index) throw new Error('missing index');
    const sideCount = 5;
    geometry.setIndex(Array.from(index.array).slice(0, sideCount * 6));
    geometry.clearGroups();
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
    mesh.updateMatrixWorld(true);
    expect(CollisionMeshCollector.collect(mesh).flagged[0]?.reason).toBe('non_convex_mesh');
  });
});
