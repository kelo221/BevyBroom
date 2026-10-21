import type * as THREE from 'three';
import type { EntityBrowserCatalogEntry } from '@/entity_browser/catalog/entity_browser_catalog_entry.js';
import { entityBrowserPlacementRayCameraCreate } from '@/entity_browser/placement/entity_browser_placement_ray_camera.js';

/** Viewport under a client point: its camera and the element it renders into. */
export interface EntityBrowserPlacementViewport {
  readonly camera: THREE.Camera;
  readonly pickElement: HTMLElement;
}

/** Editor services placement at a client point relies on. */
export interface EntityBrowserPlacementHost {
  /**
   * Returns the viewport under a client point.
   *
   * @param clientX Client X.
   * @param clientY Client Y.
   * @returns Viewport, or null when the point is not over a viewport.
   */
  viewportAtClientPointResolve(clientX: number, clientY: number): EntityBrowserPlacementViewport | null;
  /**
   * Runs an action while new objects spawn along the given camera's view ray.
   *
   * @param spawnCamera Camera defining the spawn ray.
   * @param action Action that creates objects.
   */
  spawnCameraOverrideRun(spawnCamera: THREE.Camera, action: () => void): void;
}

/**
 * Places catalog entries where the user drops them: the entry's own Add action
 * runs while spawning follows the view ray through the drop point.
 */
export class EntityBrowserPlacementAtClientPoint {
  private readonly host: EntityBrowserPlacementHost;

  /**
   * Creates the placement helper.
   *
   * @param host Editor services.
   */
  constructor(host: EntityBrowserPlacementHost) {
    this.host = host;
  }

  /**
   * Returns whether a client point is over a viewport an entry can be placed
   * in.
   *
   * @param clientX Client X.
   * @param clientY Client Y.
   * @returns True over a viewport.
   */
  isPlacementTarget(clientX: number, clientY: number): boolean {
    return this.host.viewportAtClientPointResolve(clientX, clientY) !== null;
  }

  /**
   * Adds an entry on the view ray through a client point.
   *
   * @param entry Catalog entry to add.
   * @param clientX Client X of the drop point.
   * @param clientY Client Y of the drop point.
   * @returns True when the point was over a viewport and the entry was added.
   */
  place(entry: EntityBrowserCatalogEntry, clientX: number, clientY: number): boolean {
    const viewport = this.host.viewportAtClientPointResolve(clientX, clientY);
    if (viewport === null) {
      return false;
    }
    const rayCamera = entityBrowserPlacementRayCameraCreate(viewport.camera, viewport.pickElement, clientX, clientY);
    this.host.spawnCameraOverrideRun(rayCamera, () => entry.activate());
    return true;
  }
}
