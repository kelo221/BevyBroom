import * as THREE from 'three';
import { entityOwnerOfPart } from '@/entity/model/entity_owner_keys.js';
import { isSpawnRaycastMesh } from '@/navigation/placement/object_spawn_placement.js';

/** Farthest a floor is looked for below a light, in meters. */
const GAME_ENTITY_FLOOR_PROBE_MAX_DISTANCE = 1000;

/** Straight down; never modified. */
const GAME_ENTITY_FLOOR_PROBE_DOWN = new THREE.Vector3(0, -1, 0);

/**
 * Measures how high a point hangs above the level geometry under it, ignoring
 * entities and their models.
 */
export class GameEntityFixtureLightFloorProbe {
  /**
   * Returns the distance from a point straight down to the first level surface.
   *
   * @param worldObject Scene root.
   * @param worldPoint Point in world space.
   * @returns Distance in meters, or the point's height above zero when nothing
   *   lies below it.
   */
  static heightAboveFloor(worldObject: THREE.Object3D, worldPoint: THREE.Vector3): number {
    worldObject.updateMatrixWorld(true);
    const raycaster = new THREE.Raycaster(
      worldPoint,
      GAME_ENTITY_FLOOR_PROBE_DOWN,
      0,
      GAME_ENTITY_FLOOR_PROBE_MAX_DISTANCE,
    );
    const hit = raycaster.intersectObjects(GameEntityFixtureLightFloorProbe.floorMeshesOf(worldObject), false)[0];
    return hit === undefined ? Math.max(0, worldPoint.y) : hit.distance;
  }

  /**
   * Collects the level meshes a floor can be: visible content meshes that are
   * no part of an entity.
   *
   * @param worldObject Scene root.
   * @returns Meshes to cast against.
   */
  private static floorMeshesOf(worldObject: THREE.Object3D): THREE.Mesh[] {
    const meshes: THREE.Mesh[] = [];
    worldObject.traverseVisible((object) => {
      if (isSpawnRaycastMesh(object) && entityOwnerOfPart(object) === null) {
        meshes.push(object);
      }
    });
    return meshes;
  }
}
