import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SolidModelCodec } from '@/solid/io/solid_model_codec.js';
import { remapSerializedSolidBrushIdentities } from '@/solid/model/solid_model_duplicate.js';
import { isSolidCsgGroup, markAsSolidCsgGroup } from '@/solid/model/solid_group.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';

/**
 * Adds a box brush to a model at a local position.
 *
 * @param model Solid model.
 * @param position Position local to the parent.
 * @param parent Solid CSG group, or null for the model root.
 * @returns Brush mesh.
 */
function brushMeshAdd(model: SolidModel, position: THREE.Vector3, parent: THREE.Object3D | null = null): THREE.Mesh {
  const brush = model.addBoxBrush(2, SolidOperation.Additive, parent, false);
  model.setBrushTransform(brush.id, position);
  const mesh = brush.mesh;
  if (mesh === null) {
    throw new Error('The brush has no mesh');
  }
  return mesh;
}

/**
 * Returns the world position of an object.
 *
 * @param object Scene object.
 * @returns World position.
 */
function worldPositionRead(object: THREE.Object3D): THREE.Vector3 {
  object.updateWorldMatrix(true, false);
  return new THREE.Vector3().setFromMatrixPosition(object.matrixWorld);
}

/**
 * Creates a model under a world at a placement.
 *
 * @param world World root.
 * @param position Model root position.
 * @param yaw Model root rotation around Y.
 * @returns The model.
 */
function placedModelCreate(world: THREE.Group, position: THREE.Vector3, yaw: number): SolidModel {
  const model = new SolidModel('Placed');
  model.root.position.copy(position);
  model.root.rotation.set(0, yaw, 0);
  world.add(model.root);
  return model;
}

/** World-space encoding of selected solid nodes and decoding into another model. */
describe('SolidModelCodec world space nodes', () => {
  it('encodes top-level node transforms in world space and keeps nested ones local', () => {
    const world = new THREE.Group();
    const model = placedModelCreate(world, new THREE.Vector3(5, 0, 0), Math.PI / 2);
    const group = new THREE.Group();
    markAsSolidCsgGroup(group);
    group.position.set(1, 0, 0);
    model.root.add(group);
    const nested = brushMeshAdd(model, new THREE.Vector3(0, 2, 0), group);
    const data = SolidModelCodec.encodeNodesWorldSpace(model, [group]);
    const [groupTransform] = SolidModelCodec.topLevelTransformsRead(data);
    const groupWorld = worldPositionRead(group);
    expect(groupTransform?.position).toBeDefined();
    expect(
      new THREE.Vector3(groupTransform?.position.x, groupTransform?.position.y, groupTransform?.position.z).distanceTo(
        groupWorld,
      ),
    ).toBeLessThan(1e-6);
    expect(data.brushes).toHaveLength(1);
    expect(data.brushes[0]?.position.y).toBeCloseTo(nested.position.y, 9);
  });

  it('decodes nodes into another model at the same world positions after the existing children', () => {
    const world = new THREE.Group();
    const source = placedModelCreate(world, new THREE.Vector3(-3, 1, 2), 0.4);
    const brushMesh = brushMeshAdd(source, new THREE.Vector3(2, 0, -1));
    const group = new THREE.Group();
    markAsSolidCsgGroup(group);
    source.root.add(group);
    const groupBrush = brushMeshAdd(source, new THREE.Vector3(0, 3, 0), group);
    const target = placedModelCreate(world, new THREE.Vector3(10, -2, 4), -1.1);
    const existing = brushMeshAdd(target, new THREE.Vector3(0, 0, 0));
    const data = SolidModelCodec.encodeNodesWorldSpace(source, [brushMesh, group]);
    remapSerializedSolidBrushIdentities(data);
    const created = SolidModelCodec.decodeNodesInto(target, data);
    expect(created).toHaveLength(2);
    expect(target.root.children.indexOf(existing)).toBeLessThan(target.root.children.indexOf(created[0] ?? existing));
    expect(worldPositionRead(created[0] ?? existing).distanceTo(worldPositionRead(brushMesh))).toBeLessThan(1e-6);
    const createdGroup = created[1] ?? existing;
    expect(isSolidCsgGroup(createdGroup)).toBe(true);
    const createdGroupBrush = createdGroup.children[0] ?? createdGroup;
    expect(worldPositionRead(createdGroupBrush).distanceTo(worldPositionRead(groupBrush))).toBeLessThan(1e-6);
    expect(target.getBrushCount()).toBe(3);
  });
});
