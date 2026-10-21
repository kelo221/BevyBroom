import type * as THREE from 'three';
import type { LayerManager } from '@/layer/model/layer_manager.js';

/**
 * Finds the layer manager that owns a world root, so code that only holds a
 * scene object can read the layers of its document.
 */
export class LayerManagerLookup {
  private static readonly managersByWorldGroup = new WeakMap<THREE.Object3D, LayerManager>();

  /**
   * Binds a layer manager to its world root.
   *
   * @param worldGroup World root the manager owns.
   * @param manager Layer manager.
   */
  static register(worldGroup: THREE.Object3D, manager: LayerManager): void {
    LayerManagerLookup.managersByWorldGroup.set(worldGroup, manager);
  }

  /**
   * Unbinds a layer manager from its world root when it is still the bound one.
   *
   * @param worldGroup World root the manager owned.
   * @param manager Layer manager to unbind.
   */
  static unregister(worldGroup: THREE.Object3D, manager: LayerManager): void {
    if (LayerManagerLookup.managersByWorldGroup.get(worldGroup) === manager) {
      LayerManagerLookup.managersByWorldGroup.delete(worldGroup);
    }
  }

  /**
   * Returns the layer manager of a world root.
   *
   * @param worldGroup Candidate world root.
   * @returns The bound manager, or null when the object is no managed world
   *   root.
   */
  static find(worldGroup: THREE.Object3D): LayerManager | null {
    return LayerManagerLookup.managersByWorldGroup.get(worldGroup) ?? null;
  }
}
