import * as THREE from 'three';

/**
 * Turn around the subject of a fresh view, in radians: a three-quarter view
 * from the front right.
 */
export const ENTITY_BROWSER_PREVIEW_ORBIT_YAW_DEFAULT = Math.PI / 5;

/** Look-down angle of a fresh view, in radians. */
export const ENTITY_BROWSER_PREVIEW_ORBIT_PITCH_DEFAULT = Math.PI / 8;

/** Steepest look-down or look-up angle, in radians, kept short of straight down. */
export const ENTITY_BROWSER_PREVIEW_ORBIT_PITCH_LIMIT = Math.PI / 2 - 0.05;

/** Radians the view turns per dragged CSS pixel. */
export const ENTITY_BROWSER_PREVIEW_ORBIT_RADIANS_PER_PIXEL = 0.01;

/** Closest zoom, as a fraction of the framing distance. */
export const ENTITY_BROWSER_PREVIEW_ORBIT_ZOOM_MIN = 0.35;

/** Farthest zoom, as a multiple of the framing distance. */
export const ENTITY_BROWSER_PREVIEW_ORBIT_ZOOM_MAX = 4;

/** Zoom change per wheel delta unit. */
const ENTITY_BROWSER_PREVIEW_ORBIT_ZOOM_PER_WHEEL_UNIT = 0.0015;

/** Extra room around the subject when framing it, as a multiple of its radius. */
const ENTITY_BROWSER_PREVIEW_ORBIT_FRAMING_MARGIN = 1.2;

/** Scratch offset from the subject centre to the camera. */
const entityBrowserPreviewOrbitOffset = new THREE.Vector3();

/**
 * Orbit view of a preview: turn and look-down angles around the subject and a
 * zoom relative to the distance that fits the subject in view.
 */
export class EntityBrowserPreviewOrbit {
  yaw = ENTITY_BROWSER_PREVIEW_ORBIT_YAW_DEFAULT;
  pitch = ENTITY_BROWSER_PREVIEW_ORBIT_PITCH_DEFAULT;
  zoom = 1;

  /** Returns the view to the fresh three-quarter angle and fitting zoom. */
  reset(): void {
    this.yaw = ENTITY_BROWSER_PREVIEW_ORBIT_YAW_DEFAULT;
    this.pitch = ENTITY_BROWSER_PREVIEW_ORBIT_PITCH_DEFAULT;
    this.zoom = 1;
  }

  /**
   * Turns the view by a pointer drag: sideways turns around the vertical axis,
   * up and down changes the look-down angle within its limits.
   *
   * @param deltaXPx Horizontal drag in CSS pixels.
   * @param deltaYPx Vertical drag in CSS pixels.
   */
  dragBy(deltaXPx: number, deltaYPx: number): void {
    this.yaw -= deltaXPx * ENTITY_BROWSER_PREVIEW_ORBIT_RADIANS_PER_PIXEL;
    const pitch = this.pitch + deltaYPx * ENTITY_BROWSER_PREVIEW_ORBIT_RADIANS_PER_PIXEL;
    this.pitch = THREE.MathUtils.clamp(
      pitch,
      -ENTITY_BROWSER_PREVIEW_ORBIT_PITCH_LIMIT,
      ENTITY_BROWSER_PREVIEW_ORBIT_PITCH_LIMIT,
    );
  }

  /**
   * Zooms by a wheel step: positive deltas move away, negative deltas move
   * closer.
   *
   * @param wheelDeltaY Wheel delta in the wheel event's units.
   */
  zoomBy(wheelDeltaY: number): void {
    const zoom = this.zoom * Math.exp(wheelDeltaY * ENTITY_BROWSER_PREVIEW_ORBIT_ZOOM_PER_WHEEL_UNIT);
    this.zoom = THREE.MathUtils.clamp(
      zoom,
      ENTITY_BROWSER_PREVIEW_ORBIT_ZOOM_MIN,
      ENTITY_BROWSER_PREVIEW_ORBIT_ZOOM_MAX,
    );
  }

  /**
   * Places a perspective camera on the orbit so a sphere fits in view, then
   * aims it at the sphere centre.
   *
   * @param camera Perspective camera to place.
   * @param subjectBounds Sphere around the subject.
   */
  cameraPlace(camera: THREE.PerspectiveCamera, subjectBounds: THREE.Sphere): void {
    const distance = EntityBrowserPreviewOrbit.framingDistance(camera, subjectBounds.radius) * this.zoom;
    const horizontal = Math.cos(this.pitch) * distance;
    entityBrowserPreviewOrbitOffset.set(
      Math.sin(this.yaw) * horizontal,
      Math.sin(this.pitch) * distance,
      Math.cos(this.yaw) * horizontal,
    );
    camera.position.copy(subjectBounds.center).add(entityBrowserPreviewOrbitOffset);
    camera.near = Math.max(distance - subjectBounds.radius * 2, distance * 0.01);
    camera.far = distance + subjectBounds.radius * 2;
    camera.lookAt(subjectBounds.center);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
  }

  /**
   * Returns the camera distance at which a sphere fits the narrower field of
   * view.
   *
   * @param camera Perspective camera.
   * @param radius Sphere radius.
   * @returns Distance from the sphere centre.
   */
  static framingDistance(camera: THREE.PerspectiveCamera, radius: number): number {
    const verticalHalfAngle = THREE.MathUtils.degToRad(camera.fov) / 2;
    const horizontalHalfAngle = Math.atan(Math.tan(verticalHalfAngle) * camera.aspect);
    const narrowHalfAngle = Math.min(verticalHalfAngle, horizontalHalfAngle);
    return (radius * ENTITY_BROWSER_PREVIEW_ORBIT_FRAMING_MARGIN) / Math.sin(narrowHalfAngle);
  }
}
