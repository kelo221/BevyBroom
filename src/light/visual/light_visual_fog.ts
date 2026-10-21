import * as THREE from 'three';
import { EntityVisualBuilder } from '@/entity/visual/entity_visual_builder.js';
import { EntityVisualShapes } from '@/entity/visual/entity_visual_shapes.js';
import type { LightSettings } from '@/light/model/light_settings.js';

/** Opacity of the fog volume outline. */
const LIGHT_FOG_OUTLINE_OPACITY = 0.3;

/** Lines drawn along the side of a fog cone. */
const LIGHT_FOG_CONE_SIDE_LINES = 8;

/** Widest angle in degrees a fog shaft opens by, as in the game's fog. */
const LIGHT_FOG_SHAFT_MAX_DEGREES = 75;

/** One axis frame of a fog cone or shaft: its direction and two side axes. */
interface LightFogAxisFrame {
  readonly axis: THREE.Vector3;
  readonly first: THREE.Vector3;
  readonly second: THREE.Vector3;
}

/** Frame of shapes along the light's forward (−Z) axis. */
const LIGHT_FOG_FRAME_FORWARD: LightFogAxisFrame = {
  axis: new THREE.Vector3(0, 0, -1),
  first: new THREE.Vector3(1, 0, 0),
  second: new THREE.Vector3(0, 1, 0),
};

/** Frame of shapes along the light's up (+Y) axis. */
const LIGHT_FOG_FRAME_UP: LightFogAxisFrame = {
  axis: new THREE.Vector3(0, 1, 0),
  first: new THREE.Vector3(1, 0, 0),
  second: new THREE.Vector3(0, 0, 1),
};

/**
 * Builds the faint dashed outline of a light's volumetric fog: a sphere, box,
 * cone or shaft matching the shape the game fills with fog.
 */
export class LightVisualFog {
  /**
   * Creates the outline of the fog volume.
   *
   * @param settings Light settings with fog enabled.
   * @returns Non-pickable line segments.
   */
  static outlineCreate(settings: LightSettings): THREE.LineSegments {
    const style = { colorHex: settings.colorHex, opacity: LIGHT_FOG_OUTLINE_OPACITY, dashed: true };
    return EntityVisualBuilder.linesCreate(LightVisualFog.outlinePoints(settings), style, 'Light Fog');
  }

  /**
   * Returns the outline of the fog volume as segment endpoint pairs.
   *
   * @param settings Light settings.
   * @returns Endpoint pairs in owner space.
   */
  static outlinePoints(settings: LightSettings): THREE.Vector3[] {
    const points: THREE.Vector3[] = [];
    const radius = settings.fogRadius;
    if (settings.fogShape === 'box') {
      EntityVisualShapes.boxEdgesAppend(points, new THREE.Vector3(radius, radius, radius));
    } else if (settings.fogShape === 'cone_z' || settings.fogShape === 'cone_y') {
      const frame = settings.fogShape === 'cone_z' ? LIGHT_FOG_FRAME_FORWARD : LIGHT_FOG_FRAME_UP;
      LightVisualFog.coneAppend(points, frame, radius, LightVisualFog.coneHalfAngle(settings.outerCutoffDegrees));
    } else if (settings.fogShape === 'frustum') {
      LightVisualFog.shaftAppend(points, radius, settings.outerCutoffDegrees);
    } else {
      LightVisualFog.sphereAppend(points, radius);
    }
    return points;
  }

  /**
   * Returns the half angle the game opens a fog cone to for a spot angle: the
   * cosine of 90° plus the angle, widened by up to 30% toward 90°.
   *
   * @param outerCutoffDegrees Outer spot angle in degrees.
   * @returns Cone half angle in radians.
   */
  static coneHalfAngle(outerCutoffDegrees: number): number {
    const widen = THREE.MathUtils.lerp(1, 1.3, THREE.MathUtils.clamp(outerCutoffDegrees / 90, 0, 1));
    return Math.abs(Math.cos(Math.PI / 2 + THREE.MathUtils.degToRad(outerCutoffDegrees)) * widen);
  }

  /**
   * Appends three orthogonal circles of a sphere around the light.
   *
   * @param points Output endpoint list.
   * @param radius Sphere radius.
   */
  private static sphereAppend(points: THREE.Vector3[], radius: number): void {
    const center = new THREE.Vector3();
    const { axis, first, second } = LIGHT_FOG_FRAME_FORWARD;
    EntityVisualShapes.circleAppend(points, center, first, second, radius);
    EntityVisualShapes.circleAppend(points, center, first, axis, radius);
    EntityVisualShapes.circleAppend(points, center, second, axis, radius);
  }

  /**
   * Appends a cone from the light along an axis: its rim and side lines.
   *
   * @param points Output endpoint list.
   * @param frame Cone axis and side axes.
   * @param height Distance from the light to the rim.
   * @param halfAngle Cone half angle in radians.
   */
  private static coneAppend(
    points: THREE.Vector3[],
    frame: LightFogAxisFrame,
    height: number,
    halfAngle: number,
  ): void {
    const rimCenter = frame.axis.clone().multiplyScalar(height);
    const rimRadius = height * Math.tan(halfAngle);
    EntityVisualShapes.circleAppend(points, rimCenter, frame.first, frame.second, rimRadius);
    const apex = new THREE.Vector3();
    EntityVisualShapes.spokesAppend(
      points,
      apex,
      rimCenter,
      frame.first,
      frame.second,
      rimRadius,
      LIGHT_FOG_CONE_SIDE_LINES,
    );
  }

  /**
   * Appends a square shaft from the light along −Z that widens by the spot
   * angle: its far rectangle and the four edges from the light.
   *
   * @param points Output endpoint list.
   * @param length Shaft length.
   * @param outerCutoffDegrees Outer spot angle in degrees.
   */
  private static shaftAppend(points: THREE.Vector3[], length: number, outerCutoffDegrees: number): void {
    const angle = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(outerCutoffDegrees, 0, LIGHT_FOG_SHAFT_MAX_DEGREES));
    const halfWidth = length * Math.tan(angle);
    const corners = [
      new THREE.Vector3(-halfWidth, -halfWidth, -length),
      new THREE.Vector3(halfWidth, -halfWidth, -length),
      new THREE.Vector3(halfWidth, halfWidth, -length),
      new THREE.Vector3(-halfWidth, halfWidth, -length),
    ];
    corners.forEach((corner, index) => {
      const next = corners[(index + 1) % corners.length] ?? corner;
      points.push(new THREE.Vector3(), corner.clone(), corner.clone(), next.clone());
    });
  }
}
