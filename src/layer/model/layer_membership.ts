import type * as THREE from 'three';
import type { LayerDefinition } from '@/layer/model/layer_definition.js';
import type { LayerManager } from '@/layer/model/layer_manager.js';
import { LayerManagerLookup } from '@/layer/model/layer_manager_lookup.js';

/** UserData key holding the layer identifier of a top-level world object. */
export const LAYER_USERDATA_KEY = 'editorLayerId';

/**
 * Reads the layer identifier stored on an object.
 *
 * @param object Scene object.
 * @returns Stored identifier, or null when the object stores none.
 */
export function layerIdStoredRead(object: THREE.Object3D): string | null {
  const storedIdentifier = object.userData[LAYER_USERDATA_KEY];
  return typeof storedIdentifier === 'string' && storedIdentifier.length > 0 ? storedIdentifier : null;
}

/**
 * Stores a layer identifier on an object, or removes it.
 *
 * @param object Scene object.
 * @param layerIdentifier Identifier to store, or null to remove the stored one.
 */
export function layerIdStoredWrite(object: THREE.Object3D, layerIdentifier: string | null): void {
  if (layerIdentifier === null) {
    delete object.userData[LAYER_USERDATA_KEY];
    return;
  }
  object.userData[LAYER_USERDATA_KEY] = layerIdentifier;
}

/**
 * Finds the ancestor of an object (or the object itself) that is a direct child
 * of a world root with a layer manager.
 *
 * @param object Scene object.
 * @returns The top-level world object, or null when the object is under no
 *   managed world root.
 */
export function layerTopLevelObjectResolve(object: THREE.Object3D): THREE.Object3D | null {
  let current: THREE.Object3D = object;
  while (current.parent !== null) {
    if (LayerManagerLookup.find(current.parent) !== null) {
      return current;
    }
    current = current.parent;
  }
  return null;
}

/**
 * Finds the layer manager of the world an object belongs to.
 *
 * @param object Scene object.
 * @returns Layer manager, or null when the object is under no managed world.
 */
export function layerManagerOfObjectResolve(object: THREE.Object3D): LayerManager | null {
  const topLevelObject = layerTopLevelObjectResolve(object);
  if (topLevelObject === null || topLevelObject.parent === null) {
    return null;
  }
  return LayerManagerLookup.find(topLevelObject.parent);
}

/**
 * Resolves the layer an object belongs to through its top-level ancestor.
 *
 * @param object Scene object.
 * @returns The object's layer, or null when it is under no managed world or is
 *   an editor helper that belongs to no layer.
 */
export function layerOfObjectResolve(object: THREE.Object3D): LayerDefinition | null {
  const topLevelObject = layerTopLevelObjectResolve(object);
  if (topLevelObject === null || topLevelObject.parent === null) {
    return null;
  }
  const manager = LayerManagerLookup.find(topLevelObject.parent);
  return manager === null ? null : manager.layerOfTopLevelObjectResolve(topLevelObject);
}

/**
 * Returns whether an object belongs to a hidden layer.
 *
 * @param object Scene object.
 * @returns True when the object's layer is hidden.
 */
export function objectInHiddenLayerIs(object: THREE.Object3D): boolean {
  return layerOfObjectResolve(object)?.hidden === true;
}

/**
 * Returns whether an object belongs to a locked layer.
 *
 * @param object Scene object.
 * @returns True when the object's layer is locked.
 */
export function objectInLockedLayerIs(object: THREE.Object3D): boolean {
  return layerOfObjectResolve(object)?.locked === true;
}

/**
 * Returns whether an object belongs to a layer left out of exports.
 *
 * @param object Scene object.
 * @returns True when the object's layer is omitted from export.
 */
export function objectInOmittedLayerIs(object: THREE.Object3D): boolean {
  return layerOfObjectResolve(object)?.omitFromExport === true;
}

/**
 * Returns whether an object belongs to a layer whose objects cannot be picked
 * or selected because the layer is hidden or locked.
 *
 * @param object Scene object.
 * @returns True when the object's layer is hidden or locked.
 */
export function objectInUnselectableLayerIs(object: THREE.Object3D): boolean {
  const layer = layerOfObjectResolve(object);
  return layer !== null && (layer.hidden || layer.locked);
}
