import * as THREE from 'three';
import { EntityHandle, type EntityHandleView } from '@/entity/handles/entity_handle.js';
import type { LightSettings } from '@/light/model/light_settings.js';

/**
 * Largest |cos| between a spot axis and the view direction that still shows the
 * axis sideways.
 */
const LIGHT_HANDLE_AXIS_SIDEWAYS_LIMIT = 0.995;

/**
 * Base of the handles of a light: reads the light's center and spot axis and
 * tells when a spot axis points at or away from the camera.
 */
export abstract class LightHandle extends EntityHandle<LightSettings> {
  /**
   * Returns the world position of a light.
   *
   * @param owner Light owner with a current world matrix.
   * @returns World center.
   */
  protected static centerOf(owner: THREE.Object3D): THREE.Vector3 {
    return owner.getWorldPosition(new THREE.Vector3());
  }

  /**
   * Returns the world direction a spot light shines in, its local −Z.
   *
   * @param owner Light owner with a current world matrix.
   * @returns Unit world axis.
   */
  protected static axisOf(owner: THREE.Object3D): THREE.Vector3 {
    const quaternion = owner.getWorldQuaternion(new THREE.Quaternion());
    return new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion);
  }

  /**
   * Returns the direction the camera looks in at the light.
   *
   * @param view Light owner and camera.
   * @returns Unit view direction.
   */
  protected static viewDirectionOf(view: EntityHandleView): THREE.Vector3 {
    return EntityHandle.viewDirectionAt(view.camera, LightHandle.centerOf(view.owner));
  }

  /**
   * Returns whether a spot axis is seen sideways, so a point on it can be told
   * apart from the light's center on screen.
   *
   * @param view Light owner and camera.
   * @returns False when the axis points at or away from the camera.
   */
  protected static axisSeenSideways(view: EntityHandleView): boolean {
    const alignment = LightHandle.axisOf(view.owner).dot(LightHandle.viewDirectionOf(view));
    return Math.abs(alignment) < LIGHT_HANDLE_AXIS_SIDEWAYS_LIMIT;
  }

  /**
   * Returns the normal of the plane that contains the spot axis and faces the
   * camera as much as possible. Valid only while the axis is seen sideways.
   *
   * @param view Light owner and camera.
   * @returns Unit plane normal.
   */
  protected static axisPlaneNormal(view: EntityHandleView): THREE.Vector3 {
    const axis = LightHandle.axisOf(view.owner);
    const viewDirection = LightHandle.viewDirectionOf(view);
    return viewDirection.addScaledVector(axis, -viewDirection.dot(axis)).normalize();
  }

  /**
   * Returns the unit direction across the spot axis that points to the right on
   * screen as far as possible.
   *
   * @param view Light owner and camera.
   * @returns Unit direction perpendicular to the axis.
   */
  protected static axisSideOf(view: EntityHandleView): THREE.Vector3 {
    const axis = LightHandle.axisOf(view.owner);
    const cameraRight = EntityHandle.cameraRightWorld(view.camera);
    if (!LightHandle.axisSeenSideways(view)) {
      return cameraRight.addScaledVector(axis, -cameraRight.dot(axis)).normalize();
    }
    const side = new THREE.Vector3().crossVectors(LightHandle.axisPlaneNormal(view), axis).normalize();
    return side.dot(cameraRight) < 0 ? side.negate() : side;
  }

  /**
   * Splits a world point into its distance along the spot axis and its distance
   * from the axis.
   *
   * @param owner Light owner.
   * @param point World point.
   * @returns Distance along the axis (signed) and from the axis.
   */
  protected static axisDistancesOf(owner: THREE.Object3D, point: THREE.Vector3): { along: number; across: number } {
    const axis = LightHandle.axisOf(owner);
    const offset = point.clone().sub(LightHandle.centerOf(owner));
    const along = offset.dot(axis);
    return { along, across: offset.addScaledVector(axis, -along).length() };
  }
}
