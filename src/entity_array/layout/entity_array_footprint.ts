import * as THREE from 'three';
import { entityBoundsLocalOf } from '@/entity/bounds/entity_bounds.js';
import { entityOwnerIs, entityPickMeshIs } from '@/entity/model/entity_owner_keys.js';
import { EntityOwnerRegistry } from '@/entity/registry/entity_owner_registry.js';

/**
 * Measures the space one entity fills in its own space, which sets how far
 * apart the copies of an array stand.
 */
export class EntityArrayFootprint {
  /**
   * Returns the box an entity fills in its own space: the box its kind
   * declares, else the box around its clickable markers once they show its
   * current settings and data.
   *
   * @param owner Entity owner.
   * @returns Local box, or an empty box when the entity has neither.
   */
  static boxOf(owner: THREE.Object3D): THREE.Box3 {
    const declared = entityBoundsLocalOf(owner);
    if (declared !== null) {
      return declared;
    }
    EntityArrayFootprint.visualsRefresh(owner);
    return EntityArrayFootprint.pickMeshesBoxOf(owner);
  }

  /**
   * Brings an entity's markers up to date with its settings and data, which
   * some kinds otherwise do just before they are drawn.
   *
   * @param owner Entity owner.
   */
  private static visualsRefresh(owner: THREE.Object3D): void {
    const helper = EntityOwnerRegistry.find(owner);
    const settings = helper?.settingsRead(owner) ?? null;
    if (helper !== null && settings !== null) {
      helper.definition.visualsRefresh(owner, settings);
    }
  }

  /**
   * Returns the size of the box an entity fills in its own space.
   *
   * @param owner Entity owner.
   * @returns Edge lengths; zero on every axis for an empty box.
   */
  static sizeOf(owner: THREE.Object3D): THREE.Vector3 {
    const box = EntityArrayFootprint.boxOf(owner);
    return box.isEmpty() ? new THREE.Vector3() : box.getSize(new THREE.Vector3());
  }

  /**
   * Returns the box around an entity's own clickable markers in its own space,
   * leaving out the entities nested under it.
   *
   * @param owner Entity owner.
   * @returns Local box, empty when the entity has no marker geometry.
   */
  private static pickMeshesBoxOf(owner: THREE.Object3D): THREE.Box3 {
    owner.updateWorldMatrix(true, true);
    const worldToOwner = owner.matrixWorld.clone().invert();
    const box = new THREE.Box3();
    EntityArrayFootprint.ownPickMeshesOf(owner).forEach((mesh) => {
      mesh.geometry.computeBoundingBox();
      const meshBox = mesh.geometry.boundingBox?.clone();
      const meshToOwner = worldToOwner.clone().multiply(mesh.matrixWorld);
      if (meshBox) {
        box.union(meshBox.applyMatrix4(meshToOwner));
      }
    });
    return box;
  }

  /**
   * Returns the clickable markers that belong to an entity itself.
   *
   * @param owner Entity owner.
   * @returns Pick meshes found below the owner without entering nested owners.
   */
  private static ownPickMeshesOf(owner: THREE.Object3D): THREE.Mesh[] {
    const meshes: THREE.Mesh[] = [];
    const visit = (object: THREE.Object3D): void => {
      if (object instanceof THREE.Mesh && entityPickMeshIs(object)) {
        meshes.push(object);
      }
      object.children.filter((child) => !entityOwnerIs(child)).forEach(visit);
    };
    owner.children.filter((child) => !entityOwnerIs(child)).forEach(visit);
    return meshes;
  }
}
