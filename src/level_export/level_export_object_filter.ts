import * as THREE from 'three';
import { shouldOmitFromExport } from '@/io/scene/export_object_omission.js';
import { objectInOmittedLayerIs } from '@/layer/model/layer_membership.js';
import { SolidModel } from '@/solid/model/solid_model.js';

/**
 * Decides which scene objects reach a level export: visible objects outside the
 * layers left out of exports, and which of them are plain content meshes.
 */
export class LevelExportObjectFilter {
  /**
   * Returns whether neither an object nor any parent up to the world sits in a
   * layer left out of exports.
   *
   * @param object Scene object.
   * @param worldGroup World root the walk stops at.
   * @returns True when the object is exported.
   */
  static exportedIs(object: THREE.Object3D, worldGroup: THREE.Object3D): boolean {
    let current: THREE.Object3D | null = object;
    while (current !== null && current !== worldGroup) {
      if (objectInOmittedLayerIs(current)) {
        return false;
      }
      current = current.parent;
    }
    return true;
  }

  /**
   * Returns whether an object is a plain content mesh, such as an Add > Box
   * mesh: a mesh that is neither part of a solid model, nor an entity visual,
   * nor an editor helper, nor nested under another mesh or an entity.
   *
   * @param object Scene object.
   * @returns True for plain content meshes.
   */
  static contentMeshIs(object: THREE.Object3D): object is THREE.Mesh {
    return (
      object instanceof THREE.Mesh &&
      !SolidModel.isSolidModelObject(object) &&
      !shouldOmitFromExport(object) &&
      LevelExportObjectFilter.contentMeshParentsAllowIs(object)
    );
  }

  /**
   * Returns whether a solid model or a plain content mesh is an object whose
   * collision a level export writes.
   *
   * @param object Scene object.
   * @returns True for solid model roots and plain content meshes.
   */
  static collisionSourceIs(object: THREE.Object3D): boolean {
    return SolidModel.isSolidModelObject(object) || LevelExportObjectFilter.contentMeshIs(object);
  }

  /**
   * Returns whether every parent of a mesh lets it export as its own content
   * mesh: no parent is a mesh, a solid model or an object left out of exports.
   *
   * @param mesh Candidate mesh.
   * @returns True when no parent claims the mesh.
   */
  private static contentMeshParentsAllowIs(mesh: THREE.Object3D): boolean {
    let parent = mesh.parent;
    while (parent !== null) {
      if (parent instanceof THREE.Mesh || SolidModel.isSolidModelObject(parent) || shouldOmitFromExport(parent)) {
        return false;
      }
      parent = parent.parent;
    }
    return true;
  }
}
