import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GlbExporter } from '@/io/glb/glb_exporter.js';
import { glbMeshNodesScenePositionsRead } from './glb_node_positions_read.js';

/** Name every exported mesh node shares, the way solid models name their result. */
const SHARED_MESH_NAME = 'Result';

/** Largest distance at which two read positions count as the same point. */
const POSITION_TOLERANCE = 1e-5;

/**
 * Adds a parent group holding a box mesh to a world, the parent placed, turned
 * and scaled away from the origin and the mesh offset inside it.
 *
 * @param world Group the parent joins.
 * @param parentOffset Position of the parent.
 * @param turnRadians Rotation of the parent around Y.
 * @returns The box mesh.
 */
function placedBoxAdd(world: THREE.Group, parentOffset: THREE.Vector3, turnRadians: number): THREE.Mesh {
  const parent = new THREE.Group();
  parent.position.copy(parentOffset);
  parent.rotation.y = turnRadians;
  parent.scale.setScalar(2);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
  mesh.name = SHARED_MESH_NAME;
  mesh.position.set(0.5, 0, 0);
  parent.add(mesh);
  world.add(parent);
  return mesh;
}

/**
 * Returns whether two boxes match within the position tolerance.
 *
 * @param actual Read box.
 * @param expected Expected box.
 * @returns True when both corners match.
 */
function boxesMatch(actual: THREE.Box3, expected: THREE.Box3): boolean {
  return (
    actual.min.distanceTo(expected.min) < POSITION_TOLERANCE && actual.max.distanceTo(expected.max) < POSITION_TOLERANCE
  );
}

describe('GLB mesh node scene positions', () => {
  it('reads every mesh node in scene space by index, even when the nodes share a name', async () => {
    const world = new THREE.Group();
    const meshes = [
      placedBoxAdd(world, new THREE.Vector3(-7, 1, 3), 0),
      placedBoxAdd(world, new THREE.Vector3(11, -2, 5), Math.PI / 3),
    ];
    world.updateMatrixWorld(true);
    const buffer = await new GlbExporter().export(world);
    const nodes = glbMeshNodesScenePositionsRead(buffer);
    expect(nodes.map((node) => node.name)).toEqual(meshes.map(() => SHARED_MESH_NAME));
    nodes.forEach((node) => expect(node.positions.length).toBeGreaterThan(0));
    const readBoxes = nodes.map((node) => new THREE.Box3().setFromPoints(node.positions));
    for (const mesh of meshes) {
      const expected = new THREE.Box3().setFromObject(mesh, true);
      expect(readBoxes.filter((box) => boxesMatch(box, expected))).toHaveLength(1);
    }
  });
});
