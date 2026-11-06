import type * as THREE from 'three';

/**
 * Listener told which solid model root had displacement surface meshes added,
 * rebuilt or removed.
 */
export type DisplacementSurfaceChangeListener = (solidRoot: THREE.Object3D) => void;

/**
 * Process-wide notifier for displacement surface mesh changes, so viewport
 * helpers can follow surfaces without scanning the scene every frame.
 */
export class DisplacementSurfaceChangeNotifier {
  private static readonly listeners = new Set<DisplacementSurfaceChangeListener>();

  /**
   * Subscribes to displacement surface mesh changes.
   *
   * @param listener Callback receiving the solid model root whose surfaces
   *   changed.
   * @returns Unsubscribe function.
   */
  static listenerAdd(listener: DisplacementSurfaceChangeListener): () => void {
    DisplacementSurfaceChangeNotifier.listeners.add(listener);
    return () => {
      DisplacementSurfaceChangeNotifier.listeners.delete(listener);
    };
  }

  /**
   * Tells every listener that the displacement surface meshes under a solid
   * model root changed.
   *
   * @param solidRoot Solid model root owning the changed meshes.
   */
  static notify(solidRoot: THREE.Object3D): void {
    DisplacementSurfaceChangeNotifier.listeners.forEach((listener) => listener(solidRoot));
  }
}
