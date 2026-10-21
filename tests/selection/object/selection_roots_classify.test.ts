import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { LightOwner } from '@/light/model/light_owner.js';
import { lightSettingsCreateDefault } from '@/light/model/light_settings.js';
import { markAsSolidCsgGroup } from '@/solid/model/solid_group.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';
import {
  selectionEntityPickMeshesResolveToOwners,
  selectionRootsClassify,
  selectionRootsCollect,
} from '@/selection/object/selection_roots_classify.js';

/**
 * Creates a unit box mesh.
 *
 * @returns Mesh.
 */
function boxCreate(): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
}

/**
 * Returns the first mesh under an object that is not the object itself.
 *
 * @param object Object to search.
 * @returns Mesh, or null when there is none.
 */
function childMeshFind(object: THREE.Object3D): THREE.Mesh | null {
  let found: THREE.Mesh | null = null;
  object.traverse((child) => {
    if (found === null && child !== object && child instanceof THREE.Mesh) {
      found = child;
    }
  });
  return found;
}

/** Selection roots shared by duplicate, delete, copy and cut. */
describe('selection roots classify', () => {
  it('collapses nested selections to their outermost roots and drops the world', () => {
    const world = new THREE.Group();
    const group = new THREE.Group();
    const nested = boxCreate();
    group.add(nested);
    world.add(group);
    expect(selectionRootsCollect([nested, group], world)).toEqual([group]);
    expect(selectionRootsCollect([world], world)).toEqual([]);
  });

  it('sorts roots into entity owners, solid nodes, regular meshes and plain groups', () => {
    const world = new THREE.Group();
    const model = new SolidModel('Level');
    world.add(model.root);
    const brush = model.addBoxBrush(2, SolidOperation.Additive, null, false);
    const csgGroup = new THREE.Group();
    markAsSolidCsgGroup(csgGroup);
    model.root.add(csgGroup);
    const light = LightOwner.create('Lamp', lightSettingsCreateDefault('point'));
    const mesh = boxCreate();
    const plainGroup = new THREE.Group();
    world.add(light, mesh, plainGroup);
    const classification = selectionRootsClassify([light, model.root, brush.mesh ?? mesh, csgGroup, mesh, plainGroup]);
    expect(classification.entityOwners).toEqual([light]);
    expect(classification.solidNodes).toEqual([model.root, brush.mesh, csgGroup]);
    expect(classification.regularMeshes).toEqual([mesh]);
    expect(classification.plainGroups).toEqual([plainGroup]);
  });

  it('resolves entity pick meshes to their owners and keeps other objects', () => {
    const light = LightOwner.create('Lamp', lightSettingsCreateDefault('point'));
    const pickMesh = childMeshFind(light);
    const mesh = boxCreate();
    expect(pickMesh).not.toBeNull();
    if (pickMesh === null) return;
    expect(selectionEntityPickMeshesResolveToOwners([pickMesh, mesh])).toEqual([light, mesh]);
  });
});
