import * as THREE from 'three';
import { entityOwnerIs, entityOwnerOfPart, entityVisualPartIs } from '@/entity/model/entity_owner_keys.js';
import { SolidBrushVisual } from '@/solid/model/solid_brush_visual.js';
import { findSolidModelRoot, isSolidCsgGroup } from '@/solid/model/solid_group.js';
import { isResultMesh, isSolidModelObject } from '@/solid/model/solid_model_keys.js';
import { SelectionFilterMode } from '@/types/selection_filter_mode.js';
import { getStateSelectionFilter, type StateSelectionFilter } from './state_selection_filter.js';

/**
 * Turns a raycast hit into the object a viewport click selects under the Groups
 * / Objects / Solids filter.
 */
export class SelectionFilterTargetResolver {
  private readonly filterState: StateSelectionFilter;

  /**
   * Creates a resolver that reads its default mode from a filter state.
   *
   * @param filterState Filter state; defaults to the shared singleton.
   */
  constructor(filterState: StateSelectionFilter = getStateSelectionFilter()) {
    this.filterState = filterState;
  }

  /**
   * Resolves the object selected when clicking a hit object.
   *
   * @param hitObject Object returned by the raycast.
   * @param worldRoot World root that is never returned.
   * @param mode Pick granularity; defaults to the effective mode of the filter
   *   state.
   * @returns Object to select.
   */
  targetResolve(
    hitObject: THREE.Object3D,
    worldRoot: THREE.Object3D,
    mode: SelectionFilterMode = this.filterState.effectiveModeRead(),
  ): THREE.Object3D {
    if (mode === SelectionFilterMode.SOLIDS) {
      return SelectionFilterTargetResolver.solidLeafResolve(hitObject, worldRoot);
    }
    const objectRoot = SelectionFilterTargetResolver.objectRootResolve(hitObject, worldRoot);
    if (mode === SelectionFilterMode.OBJECTS) {
      return objectRoot;
    }
    return SelectionFilterTargetResolver.groupRootResolve(objectRoot, worldRoot);
  }

  /**
   * Resolves the individual solid brush or leaf mesh of a hit, even inside
   * groups or entity owners. Editor-only entity visuals and compiled solid
   * results resolve to their logical object instead.
   *
   * @param hitObject Object returned by the raycast.
   * @param worldRoot World root that is never returned.
   * @returns Solid brush, leaf mesh or logical object root.
   */
  static solidLeafResolve(hitObject: THREE.Object3D, worldRoot: THREE.Object3D): THREE.Object3D {
    if (SolidBrushVisual.isBrushObject(hitObject)) {
      return hitObject;
    }
    if (hitObject instanceof THREE.Mesh && !SelectionFilterTargetResolver.derivedVisualIs(hitObject)) {
      return hitObject;
    }
    return SelectionFilterTargetResolver.objectRootResolve(hitObject, worldRoot);
  }

  /**
   * Returns whether a mesh is an editor entity visual or a compiled solid
   * result rather than authored content.
   *
   * @param mesh Candidate mesh.
   * @returns True for derived visuals.
   */
  static derivedVisualIs(mesh: THREE.Mesh): boolean {
    return entityVisualPartIs(mesh) || isResultMesh(mesh);
  }

  /**
   * Resolves the logical object of a hit: its entity owner, its solid model
   * root, or the hit itself.
   *
   * @param hitObject Object returned by the raycast.
   * @param worldRoot World root that is never returned.
   * @returns Logical object root.
   */
  static objectRootResolve(hitObject: THREE.Object3D, worldRoot: THREE.Object3D): THREE.Object3D {
    const owner = SelectionFilterTargetResolver.entityOwnerBelowWorld(hitObject, worldRoot);
    if (owner) {
      return owner;
    }
    const solidRoot = findSolidModelRoot(hitObject);
    if (solidRoot && solidRoot !== worldRoot) {
      return solidRoot;
    }
    return hitObject;
  }

  /**
   * Resolves the outermost user hierarchy group above an object root, stopping
   * before the world root.
   *
   * @param objectRoot Logical object root.
   * @param worldRoot World root that is never returned.
   * @returns Outermost user group, or the object root when it is in none.
   */
  static groupRootResolve(objectRoot: THREE.Object3D, worldRoot: THREE.Object3D): THREE.Object3D {
    let outermost = objectRoot;
    let current = objectRoot.parent;
    while (current && current !== worldRoot) {
      if (SelectionFilterTargetResolver.userGroupIs(current)) {
        outermost = current;
      }
      current = current.parent;
    }
    return outermost;
  }

  /**
   * Returns whether an object is a plain user hierarchy group rather than an
   * entity owner or a solid node.
   *
   * @param object Candidate object.
   * @returns True for user groups.
   */
  static userGroupIs(object: THREE.Object3D): boolean {
    if (!(object instanceof THREE.Group)) {
      return false;
    }
    return !entityOwnerIs(object) && !isSolidModelObject(object) && !isSolidCsgGroup(object);
  }

  /**
   * Returns the entity owner of an object when it lies below the world root.
   *
   * @param object Entity part or any object.
   * @param worldRoot World root that is never returned.
   * @returns Entity owner, or null.
   */
  private static entityOwnerBelowWorld(object: THREE.Object3D, worldRoot: THREE.Object3D): THREE.Object3D | null {
    const owner = entityOwnerOfPart(object);
    return owner && owner !== worldRoot ? owner : null;
  }
}
