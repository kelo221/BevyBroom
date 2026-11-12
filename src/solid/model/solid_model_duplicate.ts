import * as THREE from 'three';
import {
  SolidModelCodec,
  type SerializedSolidModel,
  type SerializedSolidTreeNode,
} from '@/solid/io/solid_model_codec.js';
import { SolidModel } from './solid_model.js';
import { hierarchyNameAllocator } from '@/utils/utils_hierarchy_name_allocator.js';
import { modifierStackReferencesRemap } from '@/modifier/stack/modifier_stack_references.js';

/**
 * Creates an independent solid model that deep-copies the source hierarchy,
 * brushes, modifier volumes, inverted-world flag, and root transform. Brush,
 * group and volume ids are remapped so the copy never shares identity with the
 * original.
 *
 * @param source Solid model to copy.
 * @param offset Local position offset applied to the cloned root.
 * @returns New solid model not yet parented into the scene.
 */
export function createIndependentSolidModelDuplicate(
  source: SolidModel,
  offset: THREE.Vector3 = new THREE.Vector3(0, 0, 0),
): SolidModel {
  const payload = SolidModelCodec.encode(source);
  remapSerializedSolidIdentities(payload);
  const clone = SolidModelCodec.decode(payload, source.root.name);
  applyRootTransformFromSource(source.root, clone.root, offset);
  assignUniqueHierarchyNamesUnderSolidRoot(clone.root);
  return clone;
}

/**
 * Reassigns unique global hex display names under a duplicated solid root.
 *
 * @param solidRoot Cloned solid model root.
 */
function assignUniqueHierarchyNamesUnderSolidRoot(solidRoot: THREE.Object3D): void {
  solidRoot.name = hierarchyNameAllocator.allocateFromSourceName(solidRoot.name);
  solidRoot.traverse((object) => {
    if (object === solidRoot) {
      return;
    }
    if (SolidModel.isResultMesh(object)) {
      return;
    }
    if (!object.name) {
      return;
    }
    object.name = hierarchyNameAllocator.allocateFromSourceName(object.name);
  });
}

/**
 * Gives every brush, solid CSG group and modifier volume of a serialized solid
 * a fresh id so the decode target owns unique identities, and points the
 * exclusions and caps of its modifier volumes at the new ids.
 *
 * @param payload Encoded solid model payload mutated in place.
 */
export function remapSerializedSolidIdentities(payload: SerializedSolidModel): void {
  const identityMap = new Map<string, string>();
  for (const brush of payload.brushes) {
    identityMap.set(brush.id, createFreshBrushIdentity());
    brush.id = identityMap.get(brush.id) ?? brush.id;
  }
  const hierarchy = payload.hierarchy ?? [];
  hierarchy.forEach((node) => remapHierarchyNodeIdentity(node, identityMap));
  hierarchy.forEach((node) => remapHierarchyNodeReferences(node, identityMap));
}

/**
 * Gives a hierarchy node and its descendants their new ids: brush leaves take
 * the remapped brush id, groups and modifier volumes a fresh uuid.
 *
 * @param node Hierarchy node changed in place.
 * @param identityMap Old id to new id; group and volume ids are added.
 */
function remapHierarchyNodeIdentity(node: SerializedSolidTreeNode, identityMap: Map<string, string>): void {
  if (node.kind === 'brush') {
    node.brushId = identityMap.get(node.brushId) ?? node.brushId;
    return;
  }
  const freshId = THREE.MathUtils.generateUUID();
  identityMap.set(node.id, freshId);
  node.id = freshId;
  if (node.kind === 'group') node.children.forEach((child) => remapHierarchyNodeIdentity(child, identityMap));
}

/**
 * Points the stacks of the modifier volumes at or under a hierarchy node at the
 * remapped ids.
 *
 * @param node Hierarchy node.
 * @param identityMap Old id to new id.
 */
function remapHierarchyNodeReferences(node: SerializedSolidTreeNode, identityMap: ReadonlyMap<string, string>): void {
  if (node.kind === 'modifier') modifierStackReferencesRemap(node.settings, identityMap);
  if (node.kind === 'group') node.children.forEach((child) => remapHierarchyNodeReferences(child, identityMap));
}

/**
 * Allocates a fresh brush id string unrelated to any existing model.
 *
 * @returns Unique brush identity.
 */
function createFreshBrushIdentity(): string {
  return `dup-brush-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Copies root transform from source and applies a local position offset.
 *
 * @param sourceRoot Source solid model root.
 * @param cloneRoot Destination solid model root.
 * @param offset Local position offset.
 */
function applyRootTransformFromSource(
  sourceRoot: THREE.Object3D,
  cloneRoot: THREE.Object3D,
  offset: THREE.Vector3,
): void {
  cloneRoot.position.copy(sourceRoot.position).add(offset);
  cloneRoot.quaternion.copy(sourceRoot.quaternion);
  cloneRoot.scale.copy(sourceRoot.scale);
  cloneRoot.visible = sourceRoot.visible;
}
