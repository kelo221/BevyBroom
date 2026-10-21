import * as THREE from 'three';
import type { EntityHandleSnap, EntityHandleView } from '@/entity/handles/entity_handle.js';
import { LightHandle } from '@/light/handles/light_handle.js';
import {
  LIGHT_MAX_CUTOFF_DEGREES,
  LIGHT_MIN_OUTER_CUTOFF_DEGREES,
  type LightSettings,
} from '@/light/model/light_settings.js';

/**
 * Ball on the rim of a spot cone that sets the cone's outer angle. The inner
 * angle keeps its share of the outer angle.
 */
export class LightHandleConeAngle extends LightHandle {
  readonly handleName = 'cone-angle';

  /**
   * Returns the point of the cone rim on the range sphere that lies to the
   * right of the axis on screen.
   *
   * @param view Light owner and camera.
   * @param settings Current spot light settings.
   * @returns World position of the ball.
   */
  worldPositionFor(view: EntityHandleView, settings: LightSettings): THREE.Vector3 {
    const angle = THREE.MathUtils.degToRad(settings.outerCutoffDegrees);
    const center = LightHandle.centerOf(view.owner);
    center.addScaledVector(LightHandle.axisOf(view.owner), settings.radius * Math.cos(angle));
    return center.addScaledVector(LightHandle.axisSideOf(view), settings.radius * Math.sin(angle));
  }

  /**
   * Returns the plane holding the axis and the ball for a sideways axis, or the
   * plane of the cone's rim when the axis points at the camera.
   *
   * @param view Light owner and camera.
   * @param settings Settings when the drag began.
   * @returns Drag plane through the ball.
   */
  dragPlaneFor(view: EntityHandleView, settings: LightSettings): THREE.Plane {
    const handle = this.worldPositionFor(view, settings);
    const normal = LightHandle.axisSeenSideways(view)
      ? LightHandle.axisPlaneNormal(view)
      : LightHandle.axisOf(view.owner);
    return new THREE.Plane().setFromNormalAndCoplanarPoint(normal, handle);
  }

  /**
   * Returns the settings with the outer angle set to the angle between the axis
   * and the ball, and the inner angle scaled by the same factor.
   *
   * @param view Light owner and camera.
   * @param settingsAtStart Settings when the drag began.
   * @param handleWorld Where the ball is dragged to.
   * @param snap Snapping applied to the angle.
   * @returns Settings with the new cone angles.
   */
  settingsDragged(
    view: EntityHandleView,
    settingsAtStart: LightSettings,
    handleWorld: THREE.Vector3,
    snap: EntityHandleSnap,
  ): LightSettings {
    const { along, across } = LightHandle.axisDistancesOf(view.owner, handleWorld);
    const angleDegrees = THREE.MathUtils.radToDeg(snap.snapAngleRadians(Math.atan2(across, along)));
    const outer = THREE.MathUtils.clamp(angleDegrees, LIGHT_MIN_OUTER_CUTOFF_DEGREES, LIGHT_MAX_CUTOFF_DEGREES);
    const innerShare = settingsAtStart.innerCutoffDegrees / settingsAtStart.outerCutoffDegrees;
    return { ...settingsAtStart, outerCutoffDegrees: outer, innerCutoffDegrees: outer * innerShare };
  }
}
