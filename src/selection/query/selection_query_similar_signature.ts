import * as THREE from 'three';
import {
  entityKindRead,
  entityOwnerChildOwners,
  entityPickDisabledIs,
  entityVisualPartIs,
} from '@/entity/model/entity_owner_keys.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { selectableMeshHelperIs } from '@/selection/object/selectable_mesh_filter.js';
import { extractHierarchyNameBase } from '@/utils/utils_hierarchy_name_allocator.js';

/**
 * Returns the text two objects share when they are copies of one another: the
 * name without its copy suffix and the shape of the hierarchy below it, made of
 * entity kinds with their nested entities, solids, brushes, meshes and groups.
 *
 * @param target Object to describe.
 * @returns Similarity signature.
 */
export function selectionQuerySimilarSignatureRead(target: THREE.Object3D): string {
  return `${extractHierarchyNameBase(target.name)}|${selectionQuerySimilarStructureRead(target)}`;
}

/**
 * Returns the hierarchy shape of an object: an entity tag holding its nested
 * entities' shapes, a leaf tag for solids, brushes and meshes, or a group tag
 * holding its content children's shapes.
 *
 * @param object Object to describe.
 * @returns Structure text.
 */
function selectionQuerySimilarStructureRead(object: THREE.Object3D): string {
  const entityKind = entityKindRead(object);
  if (entityKind !== null) {
    return `entity:${entityKind}(${selectionQuerySimilarStructuresJoin(entityOwnerChildOwners(object))})`;
  }
  const leafTag = selectionQuerySimilarLeafTagRead(object);
  if (leafTag !== null) {
    return leafTag;
  }
  return `group(${selectionQuerySimilarStructuresJoin(object.children)})`;
}

/**
 * Returns the shapes of the content objects of a list, sorted and joined.
 *
 * @param objects Child objects.
 * @returns Joined structure text.
 */
function selectionQuerySimilarStructuresJoin(objects: readonly THREE.Object3D[]): string {
  return objects
    .filter((child) => selectionQuerySimilarContentChildIs(child))
    .map((child) => selectionQuerySimilarStructureRead(child))
    .sort()
    .join(',');
}

/**
 * Returns the tag of an object whose inside is not compared, or null for a
 * plain group.
 *
 * @param object Object to tag.
 * @returns Solid, brush or mesh tag, or null.
 */
function selectionQuerySimilarLeafTagRead(object: THREE.Object3D): string | null {
  if (SolidModel.isSolidModelObject(object)) {
    return 'solid';
  }
  if (object instanceof THREE.Mesh) {
    return SolidModel.fromObject(object) ? 'brush' : 'mesh';
  }
  return null;
}

/**
 * Returns whether a child is authored content rather than an editor helper or a
 * copy rebuilt from its source.
 *
 * @param child Child object.
 * @returns True for content groups and meshes.
 */
function selectionQuerySimilarContentChildIs(child: THREE.Object3D): boolean {
  if (entityVisualPartIs(child) || selectableMeshHelperIs(child) || entityPickDisabledIs(child)) {
    return false;
  }
  return child instanceof THREE.Mesh || child instanceof THREE.Group;
}
