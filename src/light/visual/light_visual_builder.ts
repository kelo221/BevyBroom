import * as THREE from 'three';
import { type EntityGuideLineStyle, EntityVisualBuilder } from '@/entity/visual/entity_visual_builder.js';
import type { LightSettings } from '@/light/model/light_settings.js';

/** Radius of the clickable light marker in meters. */
export const LIGHT_MARKER_RADIUS = 0.18;

/** Line segments drawn per range circle. */
const LIGHT_RANGE_CIRCLE_SEGMENTS = 48;

/** Lines drawn along a spot cone's side. */
const LIGHT_SPOT_SIDE_LINES = 8;

/** Opacity of range and cone lines. */
const LIGHT_GUIDE_OPACITY = 0.4;

/** Shared marker geometry; never disposed because every light marker uses it. */
const lightMarkerGeometry = new THREE.OctahedronGeometry(LIGHT_MARKER_RADIUS, 0);

/**
 * Builds and refreshes the editor-only visuals of a light owner: a clickable
 * marker tinted with the light color, range circles, and a spot cone along −Z.
 */
export class LightVisualBuilder {
  /**
   * Replaces every visual part of the owner with parts matching the settings.
   *
   * @param owner Light owner group.
   * @param settings Settings the visuals show.
   */
  static refresh(owner: THREE.Object3D, settings: LightSettings): void {
    EntityVisualBuilder.guidesRemove(owner);
    const marker = EntityVisualBuilder.markerEnsure(owner, lightMarkerGeometry, 'Light Marker');
    EntityVisualBuilder.markerTint(marker, settings.colorHex, settings.enabled ? 1 : 0.35);
    owner.add(LightVisualBuilder.rangeCreate(settings));
    if (settings.kind === 'spot') {
      owner.add(LightVisualBuilder.coneCreate(settings));
    }
  }

  /**
   * Returns the guide line style of a light.
   *
   * @param settings Light settings.
   * @returns Translucent solid lines in the light color.
   */
  private static guideStyle(settings: LightSettings): EntityGuideLineStyle {
    return { colorHex: settings.colorHex, opacity: LIGHT_GUIDE_OPACITY, dashed: false };
  }

  /**
   * Creates three orthogonal circles showing the light's radius.
   *
   * @param settings Light settings.
   * @returns Line segments object.
   */
  private static rangeCreate(settings: LightSettings): THREE.LineSegments {
    const points: THREE.Vector3[] = [];
    const axes: [THREE.Vector3, THREE.Vector3][] = [
      [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0)],
      [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1)],
      [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)],
    ];
    for (const [first, second] of axes) {
      LightVisualBuilder.circleAppend(points, new THREE.Vector3(), first, second, settings.radius);
    }
    return EntityVisualBuilder.linesCreate(points, LightVisualBuilder.guideStyle(settings), 'Light Range');
  }

  /**
   * Creates the spot cone: side lines from the light to the outer cutoff
   * circle, plus the inner cutoff circle.
   *
   * @param settings Spot light settings.
   * @returns Line segments object.
   */
  private static coneCreate(settings: LightSettings): THREE.LineSegments {
    const points: THREE.Vector3[] = [];
    const outer = THREE.MathUtils.degToRad(Math.min(settings.outerCutoffDegrees, 89));
    const inner = THREE.MathUtils.degToRad(Math.min(settings.innerCutoffDegrees, 89));
    const right = new THREE.Vector3(1, 0, 0);
    const up = new THREE.Vector3(0, 1, 0);
    const outerCenter = new THREE.Vector3(0, 0, -settings.radius * Math.cos(outer));
    const outerRadius = settings.radius * Math.sin(outer);
    LightVisualBuilder.circleAppend(points, outerCenter, right, up, outerRadius);
    const innerCenter = new THREE.Vector3(0, 0, -settings.radius * Math.cos(inner));
    LightVisualBuilder.circleAppend(points, innerCenter, right, up, settings.radius * Math.sin(inner));
    LightVisualBuilder.coneSidesAppend(points, outerCenter, right, up, outerRadius);
    return EntityVisualBuilder.linesCreate(points, LightVisualBuilder.guideStyle(settings), 'Light Cone');
  }

  /**
   * Appends the side lines from the cone apex to the outer rim.
   *
   * @param points Output endpoint list.
   * @param rimCenter Center of the outer rim circle.
   * @param right First in-plane axis (unit).
   * @param up Second in-plane axis (unit).
   * @param rimRadius Radius of the outer rim.
   */
  private static coneSidesAppend(
    points: THREE.Vector3[],
    rimCenter: THREE.Vector3,
    right: THREE.Vector3,
    up: THREE.Vector3,
    rimRadius: number,
  ): void {
    for (let index = 0; index < LIGHT_SPOT_SIDE_LINES; index++) {
      const angle = (index / LIGHT_SPOT_SIDE_LINES) * Math.PI * 2;
      const rim = rimCenter
        .clone()
        .addScaledVector(right, Math.cos(angle) * rimRadius)
        .addScaledVector(up, Math.sin(angle) * rimRadius);
      points.push(new THREE.Vector3(), rim);
    }
  }

  /**
   * Appends a circle as segment endpoint pairs.
   *
   * @param points Output endpoint list.
   * @param center Circle center.
   * @param first First in-plane axis (unit).
   * @param second Second in-plane axis (unit).
   * @param radius Circle radius.
   */
  private static circleAppend(
    points: THREE.Vector3[],
    center: THREE.Vector3,
    first: THREE.Vector3,
    second: THREE.Vector3,
    radius: number,
  ): void {
    const pointAt = (step: number): THREE.Vector3 => {
      const angle = (step / LIGHT_RANGE_CIRCLE_SEGMENTS) * Math.PI * 2;
      return center
        .clone()
        .addScaledVector(first, Math.cos(angle) * radius)
        .addScaledVector(second, Math.sin(angle) * radius);
    };
    for (let step = 0; step < LIGHT_RANGE_CIRCLE_SEGMENTS; step++) {
      points.push(pointAt(step), pointAt(step + 1));
    }
  }
}
