import * as THREE from 'three';
import type { LightSettings } from '@/light/model/light_settings.js';
import {
  SHADING_LIT_POINT_CONE_COSINE,
  shadingLitCosineFromDegrees,
  shadingLitFalloffPacked,
} from '@/viewports/shading/lit/shading_lit_light_math.js';

/** One authored light in world space, in the form the Lit shading mode draws. */
export interface ShadingLitLightRecord {
  /** World position of the light. */
  readonly position: THREE.Vector3;
  /**
   * Unit world axis pointing from the lit surface back towards a spot (owner
   * +Z).
   */
  readonly axisTowardsLight: THREE.Vector3;
  /** Light color in linear RGB. */
  readonly colorLinear: THREE.Color;
  /** Light intensity. */
  readonly intensity: number;
  /** Light radius in meters. */
  readonly radius: number;
  /** Falloff as the game renderer stores it. */
  readonly falloffPacked: number;
  /** Cosine of the inner cutoff; point lights use a value that always passes. */
  readonly innerCosine: number;
  /** Cosine of the outer cutoff; point lights use a value that always passes. */
  readonly outerCosine: number;
}

/** Local axis of a light owner that points opposite to the spot direction. */
const SHADING_LIT_OWNER_AXIS_TOWARDS_LIGHT = new THREE.Vector3(0, 0, 1);

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
  const isSpot = settings.kind === 'spot';
  return {
    position: new THREE.Vector3().setFromMatrixPosition(owner.matrixWorld),
    axisTowardsLight: shadingLitLightRecordAxisFromOwner(owner),
    colorLinear: new THREE.Color().setHex(settings.colorHex, THREE.SRGBColorSpace),
    intensity: settings.intensity,
    radius: settings.radius,
    falloffPacked: shadingLitFalloffPacked(settings.radius, settings.falloff),
    innerCosine: isSpot ? shadingLitCosineFromDegrees(settings.innerCutoffDegrees) : SHADING_LIT_POINT_CONE_COSINE,
    outerCosine: isSpot ? shadingLitCosineFromDegrees(settings.outerCutoffDegrees) : SHADING_LIT_POINT_CONE_COSINE,
  };
}

/**
 * Returns the owner's local +Z axis in world space, normalized.
 *
 * @param owner Light owner group with an up-to-date world matrix.
 * @returns Unit world axis.
 */
function shadingLitLightRecordAxisFromOwner(owner: THREE.Object3D): THREE.Vector3 {
  const worldRotation = new THREE.Quaternion();
  owner.matrixWorld.decompose(new THREE.Vector3(), worldRotation, new THREE.Vector3());
  return SHADING_LIT_OWNER_AXIS_TOWARDS_LIGHT.clone().applyQuaternion(worldRotation).normalize();
}
