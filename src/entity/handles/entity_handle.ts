import * as THREE from 'three';

/** Snapping a handle drag applies to the values it produces. */
export interface EntityHandleSnap {
  /**
   * Snaps a length to the grid step.
   *
   * @param value Length in meters.
   * @returns Snapped length, or the value when snapping is off.
   */
  snapValue(value: number): number;

  /**
   * Snaps an angle to the rotation step.
   *
   * @param angleRadians Angle in radians.
   * @returns Snapped angle, or the angle when snapping is off.
   */
  snapAngleRadians(angleRadians: number): number;
}

/** Snapping that leaves every value unchanged. */
export const ENTITY_HANDLE_SNAP_NONE: EntityHandleSnap = {
  snapValue: (value) => value,
  snapAngleRadians: (angleRadians) => angleRadians,
};

/** The entity owner a handle belongs to and the camera of the pane showing it. */
export interface EntityHandleView {
  /** Entity owner group with a current world matrix. */
  owner: THREE.Object3D;
  /** Camera of the pane the handle is shown or dragged in. */
  camera: THREE.Camera;
}

/**
 * One draggable point of a selected entity, such as a light's radius ball. A
 * handle may sit at a different place in every pane, so each method receives
 * the camera it is seen through.
 */
export abstract class EntityHandle<TSettings extends object> {
  /** Name of the handle, unique among the handles of one owner. */
  abstract readonly handleName: string;

  /**
   * Returns where the handle sits as seen through a camera.
   *
   * @param view Owner and camera.
   * @param settings Current valid settings of the owner.
   * @returns World position of the handle.
   */
  abstract worldPositionFor(view: EntityHandleView, settings: TSettings): THREE.Vector3;

  /**
   * Returns the world plane the pointer moves on while dragging the handle.
   *
   * @param view Owner and camera of the dragging pane.
   * @param settings Settings when the drag began.
   * @returns Drag plane through the handle.
   */
  abstract dragPlaneFor(view: EntityHandleView, settings: TSettings): THREE.Plane;

  /**
   * Returns the settings the owner gets when the handle is dragged to a point.
   *
   * @param view Owner and camera of the dragging pane.
   * @param settingsAtStart Settings when the drag began.
   * @param handleWorld Where the handle is dragged to, on the drag plane.
   * @param snap Snapping to apply.
   * @returns New settings, before sanitizing.
   */
  abstract settingsDragged(
    view: EntityHandleView,
    settingsAtStart: TSettings,
    handleWorld: THREE.Vector3,
    snap: EntityHandleSnap,
  ): TSettings;

  /**
   * Returns the direction a camera looks in at a point: toward the point for
   * perspective cameras, the camera's forward axis otherwise.
   *
   * @param camera Viewing camera with a current world matrix.
   * @param target World point being looked at.
   * @returns Unit view direction.
   */
  static viewDirectionAt(camera: THREE.Camera, target: THREE.Vector3): THREE.Vector3 {
    const forward = camera.getWorldDirection(new THREE.Vector3());
    if (!(camera instanceof THREE.PerspectiveCamera)) {
      return forward;
    }
    const toTarget = target.clone().sub(camera.getWorldPosition(new THREE.Vector3()));
    return toTarget.lengthSq() > 0 ? toTarget.normalize() : forward;
  }

  /**
   * Returns the screen-right direction of a camera in world space.
   *
   * @param camera Viewing camera with a current world matrix.
   * @returns Unit world direction.
   */
  static cameraRightWorld(camera: THREE.Camera): THREE.Vector3 {
    const quaternion = camera.getWorldQuaternion(new THREE.Quaternion());
    return new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion);
  }
}
