import * as THREE from 'three';

/** Listener notified when Cordon active state or bounding box changes. */
export type StateCordonListener = () => void;

/**
 * Shared state for Hammer++'s Cordon bounds volume (active toggle and
 * world-space axis-aligned bounding box).
 */
export class StateCordon {
  private enabled: boolean;
  private bounds: THREE.Box3;
  private readonly listeners: Set<StateCordonListener>;

  /** Creates a Cordon state defaulting to disabled with a [-16, 16]^3 meter box. */
  constructor() {
    this.enabled = false;
    this.bounds = new THREE.Box3(new THREE.Vector3(-16, -16, -16), new THREE.Vector3(16, 16, 16));
    this.listeners = new Set();
  }

  /**
   * Returns whether Cordon filtering is currently active.
   *
   * @returns True when active.
   */
  enabledRead(): boolean {
    return this.enabled;
  }

  /**
   * Enables or disables Cordon filtering.
   *
   * @param enabled True to activate Cordon filtering.
   */
  enabledWrite(enabled: boolean): void {
    if (this.enabled === enabled) {
      return;
    }
    this.enabled = enabled;
    this.listenersNotify();
  }

  /**
   * Returns a clone of the current Cordon world-space bounding box.
   *
   * @returns Cloned Box3.
   */
  boundsRead(): THREE.Box3 {
    return this.bounds.clone();
  }

  /**
   * Updates the Cordon world-space bounding box ensuring min <= max on each
   * axis.
   *
   * @param min Minimum corner.
   * @param max Maximum corner.
   */
  boundsWrite(min: THREE.Vector3, max: THREE.Vector3): void {
    const low = new THREE.Vector3(Math.min(min.x, max.x), Math.min(min.y, max.y), Math.min(min.z, max.z));
    const high = new THREE.Vector3(Math.max(min.x, max.x), Math.max(min.y, max.y), Math.max(min.z, max.z));
    this.bounds.set(low, high);
    this.listenersNotify();
  }

  /**
   * Fits the Cordon box to the combined world-space bounds of the given
   * objects.
   *
   * @param objects Objects to enclose.
   * @returns True when at least one object contributed finite bounds.
   */
  fitToObjects(objects: readonly THREE.Object3D[]): boolean {
    const combined = new THREE.Box3();
    objects.forEach((obj) => {
      combined.expandByObject(obj);
    });
    if (combined.isEmpty()) {
      return false;
    }
    this.bounds.copy(combined);
    this.listenersNotify();
    return true;
  }

  /**
   * Tests whether a scene object intersects or lies inside the Cordon volume.
   *
   * @param object Scene object to test.
   * @returns True when the object's world bounds or position intersect the
   *   Cordon box.
   */
  intersectsObject(object: THREE.Object3D): boolean {
    const objBox = new THREE.Box3().setFromObject(object);
    if (objBox.isEmpty()) {
      const worldPos = new THREE.Vector3();
      object.getWorldPosition(worldPos);
      return this.bounds.containsPoint(worldPos);
    }
    return this.bounds.intersectsBox(objBox);
  }

  /**
   * Subscribes to Cordon state changes.
   *
   * @param listener Callback invoked on change.
   * @returns Unsubscribe function.
   */
  changeListenerAdd(listener: StateCordonListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Notifies all registered Cordon state listeners. */
  private listenersNotify(): void {
    this.listeners.forEach((listener) => listener());
  }
}
