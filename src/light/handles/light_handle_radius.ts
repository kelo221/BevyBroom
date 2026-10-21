import * as THREE from 'three';
import { EntityHandle, type EntityHandleSnap, type EntityHandleView } from '@/entity/handles/entity_handle.js';
import { LightHandle } from '@/light/handles/light_handle.js';
import { lightSettingsRadiusWrite } from '@/light/model/features/light_settings_radius.js';
import { LIGHT_MIN_RADIUS, type LightSettings } from '@/light/model/light_settings.js';

/**
 * Ball that sets a light's radius. A point light shows it on its range sphere
 * to the right of the light on screen; a spot light shows it at the tip of its
 * axis, unless the axis points at the camera. The fog radius follows.
 */
export class LightHandleRadius extends LightHandle {
  readonly handleName = 'radius';

  /**
   * Returns the ball's position: center plus radius along the handle direction.
   *
   * @param view Light owner and camera.
   * @param settings Current light settings.
   * @returns World position of the ball.
   */
  worldPositionFor(view: EntityHandleView, settings: LightSettings): THREE.Vector3 {
    const center = LightHandle.centerOf(view.owner);
    return center.addScaledVector(this.directionOf(view, settings), settings.radius);
  }

  /**
   * Returns the plane holding the spot axis and facing the camera for a
   * sideways spot axis, or the camera-facing plane through the light.
   *
   * @param view Light owner and camera.
   * @param settings Settings when the drag began.
   * @returns Drag plane through the light's center.
   */
  dragPlaneFor(view: EntityHandleView, settings: LightSettings): THREE.Plane {
    const center = LightHandle.centerOf(view.owner);
    const normal = this.usesAxis(view, settings)
      ? LightHandle.axisPlaneNormal(view)
      : EntityHandle.viewDirectionAt(view.camera, center);
    return new THREE.Plane().setFromNormalAndCoplanarPoint(normal, center);
  }

  /**
   * Returns the settings with the radius set to the ball's distance from the
   * light, measured along the axis for a sideways spot axis.
   *
   * @param view Light owner and camera.
   * @param settingsAtStart Settings when the drag began.
   * @param handleWorld Where the ball is dragged to.
   * @param snap Snapping applied to the radius.
   * @returns Settings with the new radius and fog radius.
   */
  settingsDragged(
    view: EntityHandleView,
    settingsAtStart: LightSettings,
    handleWorld: THREE.Vector3,
    snap: EntityHandleSnap,
  ): LightSettings {
    const reach = this.usesAxis(view, settingsAtStart)
      ? LightHandle.axisDistancesOf(view.owner, handleWorld).along
      : handleWorld.distanceTo(LightHandle.centerOf(view.owner));
    return lightSettingsRadiusWrite(settingsAtStart, Math.max(LIGHT_MIN_RADIUS, snap.snapValue(reach)));
  }

  /**
   * Returns whether the ball sits on the spot axis in this view.
   *
   * @param view Light owner and camera.
   * @param settings Light settings.
   * @returns True for spot lights whose axis is seen sideways.
   */
  private usesAxis(view: EntityHandleView, settings: LightSettings): boolean {
    return settings.kind === 'spot' && LightHandle.axisSeenSideways(view);
  }

  /**
   * Returns the unit direction from the light to the ball.
   *
   * @param view Light owner and camera.
   * @param settings Light settings.
   * @returns The spot axis, or the camera's screen-right direction.
   */
  private directionOf(view: EntityHandleView, settings: LightSettings): THREE.Vector3 {
    return this.usesAxis(view, settings) ? LightHandle.axisOf(view.owner) : EntityHandle.cameraRightWorld(view.camera);
  }
}
