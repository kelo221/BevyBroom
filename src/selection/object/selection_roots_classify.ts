import * as THREE from 'three';
import { entityOwnerIs, entityOwnerOfPart, entityPickMeshIs } from '@/entity/model/entity_owner_keys.js';
import { SolidBrushVisual } from '@/solid/model/solid_brush_visual.js';
import { isSolidCsgGroup } from '@/solid/model/solid_group.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { collapseToHierarchyRoots } from '@/utils/hierarchy_selection.js';

/** Hierarchy roots of a selection sorted into the kinds object commands handle. */
export interface SelectionRootsClassification {
  /** Entity owners such as lights, rooms, portals and game entities. */
  readonly entityOwners: THREE.Object3D[];
  /** Solid model roots, solid CSG groups and solid brush meshes. */
  readonly solidNodes: THREE.Object3D[];
  /** Meshes that are neither solid brushes nor entity parts. */
  readonly regularMeshes: THREE.Mesh[];
  /** Groups that are neither solid nodes nor entity owners. */
  readonly plainGroups: THREE.Group[];
}

/**
 * Collapses selected objects to their outermost hierarchy roots and drops the
 * world root itself.
 *
 * @param objects Selected hierarchy objects or meshes.
 * @param worldObject World root that is never a selection root.
 * @returns Outermost selected roots.
 */
export function selectionRootsCollect(
  objects: readonly THREE.Object3D[],
  worldObject: THREE.Object3D,
): THREE.Object3D[] {
  return collapseToHierarchyRoots([...objects]).filter((object) => object !== worldObject);
}

/**
 * Replaces entity pick meshes with the entity owners they belong to and keeps
 * every other object.
 *
 * @param objects Selected objects.
 * @returns Objects with pick meshes resolved to their owners.
 */
export function selectionEntityPickMeshesResolveToOwners(objects: readonly THREE.Object3D[]): THREE.Object3D[] {
  return objects.map((object) => (entityPickMeshIs(object) ? (entityOwnerOfPart(object) ?? object) : object));
}

/**
 * Sorts hierarchy roots into entity owners, solid nodes, regular meshes and
 * plain groups. Objects of no known kind are skipped.
 *
 * @param roots Outermost selected roots.
 * @returns Roots grouped by kind, each list in input order.
 */
export function selectionRootsClassify(roots: readonly THREE.Object3D[]): SelectionRootsClassification {
  const classification: SelectionRootsClassification = {
    entityOwners: [],
    solidNodes: [],
    regularMeshes: [],
    plainGroups: [],
  };
  for (const root of roots) {
    selectionRootClassifyInto(root, classification);
  }
  return classification;
}

/**
 * Appends one root to the list of its kind.
 *
 * @param root Hierarchy root to classify.
 * @param classification Lists receiving the root.
 */
function selectionRootClassifyInto(root: THREE.Object3D, classification: SelectionRootsClassification): void {
  if (entityOwnerIs(root)) {
    classification.entityOwners.push(root);
    return;
  }
  if (selectionRootSolidNodeIs(root)) {
    classification.solidNodes.push(root);
    return;
  }
  if (root instanceof THREE.Mesh) {
    classification.regularMeshes.push(root);
    return;
  }
  if (root instanceof THREE.Group) {
    classification.plainGroups.push(root);
  }
}

/**
 * Returns whether a root is a solid model root, a solid CSG group or a solid
 * brush mesh.
 *
 * @param root Hierarchy root.
 * @returns True for solid hierarchy nodes.
 */
function selectionRootSolidNodeIs(root: THREE.Object3D): boolean {
  if (SolidModel.isSolidModelObject(root) || isSolidCsgGroup(root)) {
    return true;
  }
  return root instanceof THREE.Mesh && SolidBrushVisual.isBrushObject(root);
}
