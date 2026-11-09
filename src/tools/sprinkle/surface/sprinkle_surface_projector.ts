import * as THREE from 'three';
import { entityOwnerOfPart } from '@/entity/model/entity_owner_keys.js';
import { SceneRaycaster } from '@/selection/object/scene_raycaster.js';
import { selectableMeshesCollect } from '@/selection/object/selectable_mesh_filter.js';
import type { SprinkleSurfaceHit } from '@/tools/sprinkle/sprinkle_types.js';

/**
 * Returns the meshes sprinkled entities can land on: the selectable meshes
 * under a world root that are not part of an entity.
 *
 * @param worldObject World root.
 * @returns Surface meshes in scene order.
 */
export function sprinkleSurfaceMeshesCollect(worldObject: THREE.Object3D): THREE.Mesh[] {
  return sprinkleSurfaceMeshesFilter(selectableMeshesCollect(worldObject));
}

/**
 * Keeps only the meshes that are not part of an entity, such as entity markers.
 *
 * @param meshes Candidate meshes.
 * @returns Meshes outside every entity.
 */
export function sprinkleSurfaceMeshesFilter(meshes: readonly THREE.Mesh[]): THREE.Mesh[] {
  return meshes.filter((mesh) => entityOwnerOfPart(mesh) === null);
}

/**
 * Turns the nearest raycast intersection into a surface hit whose normal faces
 * back along the ray.
 *
 * @param intersections Intersections ordered near-to-far.
 * @param rayDirection Direction of the cast ray.
 * @returns Surface hit, or null without intersections.
 */
export function sprinkleSurfaceHitFromIntersections(
  intersections: readonly THREE.Intersection[],
  rayDirection: THREE.Vector3,
): SprinkleSurfaceHit | null {
  const nearest = intersections[0];
  if (!nearest) {
    return null;
  }
  const normal = nearest.normal ? nearest.normal.clone() : rayDirection.clone().negate();
  if (normal.dot(rayDirection) > 0) {
    normal.negate();
  }
  return { point: nearest.point.clone(), normal: normal.normalize() };
}

/** Projects world-space rays onto the surfaces sprinkled entities land on. */
export class SprinkleSurfaceProjector {
  private readonly raycaster = new SceneRaycaster();

  /**
   * Creates a projector over a fixed set of surface meshes.
   *
   * @param surfaceMeshes Meshes rays may hit.
   */
  constructor(private readonly surfaceMeshes: THREE.Mesh[]) {}

  /**
   * Returns the nearest surface a ray hits within a distance.
   *
   * @param ray World-space ray with a unit direction.
   * @param maxDistance Farthest hit distance along the ray.
   * @returns Surface hit with its normal facing the ray origin, or null.
   */
  project(ray: THREE.Ray, maxDistance: number): SprinkleSurfaceHit | null {
    const intersections = this.raycaster.castRayIntersections(ray, this.surfaceMeshes, maxDistance);
    return sprinkleSurfaceHitFromIntersections(intersections, ray.direction);
  }

  /**
   * Returns the nearest surface under a pointer in a viewport.
   *
   * @param event Pointer event with client coordinates.
   * @param camera Viewport camera.
   * @param pickElement Viewport content element.
   * @returns Surface hit with its normal facing the camera, or null.
   */
  projectPointer(event: MouseEvent, camera: THREE.Camera, pickElement: HTMLElement): SprinkleSurfaceHit | null {
    const intersections = this.raycaster.castIntersections(camera, pickElement, event, this.surfaceMeshes);
    const nearest = intersections[0];
    return nearest
      ? sprinkleSurfaceHitFromIntersections(intersections, this.viewDirectionRead(camera, nearest.point))
      : null;
  }

  /**
   * Returns the direction a camera looks at a point along: the view direction
   * of orthographic cameras, from the eye to the point otherwise.
   *
   * @param camera Viewport camera.
   * @param point World point the camera sees.
   * @returns Unit direction.
   */
  private viewDirectionRead(camera: THREE.Camera, point: THREE.Vector3): THREE.Vector3 {
    if (camera instanceof THREE.OrthographicCamera) {
      return camera.getWorldDirection(new THREE.Vector3());
    }
    return point.clone().sub(camera.getWorldPosition(new THREE.Vector3())).normalize();
  }
}
