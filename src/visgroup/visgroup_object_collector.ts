import * as THREE from 'three';
import { entityOwnerIs } from '@/entity/model/entity_owner_keys.js';
import { isSolidModelObject } from '@/solid/model/solid_model_keys.js';
import { isEditorHelperObject } from '@/utils/mesh_edge_sync.js';

/** UserData flag on editor-only helpers that are never scene content. */
export const EDITOR_HELPER_USERDATA_KEY = 'isEditorHelper';

/** Finds the scene objects that visibility filters treat as single units. */
export class VisGroupObjectCollector {
  /**
   * Collects entity owners, solid model roots, lights and content meshes under
   * a world root without descending into entity owners or solid models.
   *
   * @param worldRoot World root whose content is searched.
   * @returns Logical objects in hierarchy order.
   */
  static logicalObjectsCollect(worldRoot: THREE.Object3D): THREE.Object3D[] {
    const collected: THREE.Object3D[] = [];
    worldRoot.children.forEach((child) => VisGroupObjectCollector.logicalObjectsAppend(child, collected));
    return collected;
  }

  /**
   * Collects every object under a world root, excluding the root and editor
   * helpers.
   *
   * @param worldRoot World root whose content is searched.
   * @returns Descendant objects.
   */
  static descendantsCollect(worldRoot: THREE.Object3D): THREE.Object3D[] {
    const collected: THREE.Object3D[] = [];
    worldRoot.traverse((object) => {
      if (object !== worldRoot && !VisGroupObjectCollector.editorHelperIs(object)) {
        collected.push(object);
      }
    });
    return collected;
  }

  /**
   * Returns whether an object is an editor-only helper.
   *
   * @param object Candidate object.
   * @returns True for editor helpers.
   */
  static editorHelperIs(object: THREE.Object3D): boolean {
    return object.userData[EDITOR_HELPER_USERDATA_KEY] === true || isEditorHelperObject(object);
  }

  /**
   * Appends an object when it is a logical unit, otherwise searches its
   * children.
   *
   * @param object Object to inspect.
   * @param collected Accumulator.
   */
  private static logicalObjectsAppend(object: THREE.Object3D, collected: THREE.Object3D[]): void {
    if (VisGroupObjectCollector.editorHelperIs(object)) {
      return;
    }
    if (entityOwnerIs(object) || isSolidModelObject(object) || object instanceof THREE.Light) {
      collected.push(object);
      return;
    }
    if (object instanceof THREE.Mesh) {
      collected.push(object);
    }
    object.children.forEach((child) => VisGroupObjectCollector.logicalObjectsAppend(child, collected));
  }
}
