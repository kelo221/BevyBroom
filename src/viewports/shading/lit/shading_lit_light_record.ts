import * as THREE from 'three';
import type { LightSettings } from '@/light/model/light_settings.js';
import {
  SHADING_LIT_POINT_CONE_COSINE,
  shadingLitCosineFromDegrees,
  shadingLitFalloffPacked,
  shadingLitReach,
} from '@/viewports/shading/lit/shading_lit_light_math.js';

/** One authored light in world space, in the form the Lit shading mode draws. */
export interface ShadingLitLightRecord {
  /** World position of the light; the center of a tube. */
  readonly position: THREE.Vector3;
  /**
   * Unit world axis: for spots it points from the lit surface back towards the
   * light (owner +Z), for tubes it runs along the tube (owner +X).
   */
  readonly axis: THREE.Vector3;
  /** Light color in linear RGB. */
  readonly colorLinear: THREE.Color;
  /** Light intensity. */
  readonly intensity: number;
  /** Light radius in meters, measured from the position. */
  readonly radius: number;
  /** Meters the light reaches past its shape; the radius for point-like lights. */
  readonly reach: number;
  /** Falloff as the game renderer stores it. */
  readonly falloffPacked: number;
  /**
   * Cosine of the inner cutoff; lights without a cone use a value that always
   * passes.
   */
  readonly innerCosine: number;
  /**
   * Cosine of the outer cutoff; lights without a cone use a value that always
   * passes.
   */
  readonly outerCosine: number;
  /** Half the tube length; zero for point and spot lights. */
  readonly tubeHalfLength: number;
}

/** Local axis of a light owner that points opposite to the spot direction. */
const SHADING_LIT_OWNER_AXIS_TOWARDS_SPOT = new THREE.Vector3(0, 0, 1);

/** Local axis of a light owner that a tube runs along. */
const SHADING_LIT_OWNER_AXIS_ALONG_TUBE = new THREE.Vector3(1, 0, 0);

/**
 * Builds the world-space record of a light owner, or null when the light gives
 * no light.
 *
 * @param owner Light owner group with an up-to-date world matrix.
 * @param settings Sanitized settings of the owner.
 * @returns Record, or null for disabled or zero-intensity lights.
 */
export function shadingLitLightRecordCreate(
  owner: THREE.Object3D,
  settings: LightSettings,
): ShadingLitLightRecord | null {
  if (!settings.enabled || settings.intensity <= 0) {
    return null;
  }
  const tubeHalfLength = settings.kind === 'tube' ? settings.tubeLength / 2 : 0;
  const reach = shadingLitReach(settings.radius, tubeHalfLength);
  return {
    position: new THREE.Vector3().setFromMatrixPosition(owner.matrixWorld),
    axis: shadingLitLightRecordAxisFromOwner(owner, settings),
    colorLinear: new THREE.Color().setHex(settings.colorHex, THREE.SRGBColorSpace),
    intensity: settings.intensity,
    radius: settings.radius,
    reach,
    falloffPacked: shadingLitFalloffPacked(reach, settings.falloff),
    innerCosine: shadingLitLightRecordConeCosine(settings, settings.innerCutoffDegrees),
    outerCosine: shadingLitLightRecordConeCosine(settings, settings.outerCutoffDegrees),
    tubeHalfLength,
  };
}

/**
 * Returns the cone cosine of a spot cutoff, or a value that always passes for
 * lights without a cone.
 *
 * @param settings Light settings.
 * @param cutoffDegrees Cutoff angle in degrees.
 * @returns Cone cosine.
 */
function shadingLitLightRecordConeCosine(settings: LightSettings, cutoffDegrees: number): number {
  return settings.kind === 'spot' ? shadingLitCosineFromDegrees(cutoffDegrees) : SHADING_LIT_POINT_CONE_COSINE;
}

/**
 * Returns the owner's spot or tube axis in world space, normalized.
 *
 * @param owner Light owner group with an up-to-date world matrix.
 * @param settings Light settings choosing the axis.
 * @returns Unit world axis.
 */
function shadingLitLightRecordAxisFromOwner(owner: THREE.Object3D, settings: LightSettings): THREE.Vector3 {
  const worldRotation = new THREE.Quaternion();
  owner.matrixWorld.decompose(new THREE.Vector3(), worldRotation, new THREE.Vector3());
  const localAxis = settings.kind === 'tube' ? SHADING_LIT_OWNER_AXIS_ALONG_TUBE : SHADING_LIT_OWNER_AXIS_TOWARDS_SPOT;
  return localAxis.clone().applyQuaternion(worldRotation).normalize();
}
