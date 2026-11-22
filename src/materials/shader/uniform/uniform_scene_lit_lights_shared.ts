import * as THREE from 'three';
import type { ShadingLitLightRecord } from '@/viewports/shading/lit/shading_lit_light_record.js';
import { SHADING_LIT_AMBIENT_LINEAR } from '@/viewports/shading/lit/shading_lit_light_math.js';

/** Most lights one Lit shading pass draws; fragment uniform space limits it. */
export const SCENE_LIT_MAXIMUM_LIGHT_COUNT = 32;

/** Uniform names of the shared scene light arrays. */
export const SCENE_LIT_UNIFORM_NAMES = {
  count: 'sceneLitLightCount',
  ambient: 'sceneLitAmbient',
  positionRadiusSquared: 'sceneLitLightPositionRadiusSquared',
  colorFalloff: 'sceneLitLightColorFalloff',
  axisInnerCosine: 'sceneLitLightAxisInnerCosine',
  outerCosine: 'sceneLitLightOuterCosine',
} as const;

/** Shared scene light uniform dictionary, or null before first use. */
let sharedSceneLitUniforms: Record<string, THREE.IUniform> | null = null;

/**
 * Returns the shared scene light uniform dictionary, building it on first use.
 *
 * @returns Shared uniform dictionary.
 */
export function uniformSceneLitSharedGet(): Record<string, THREE.IUniform> {
  if (!sharedSceneLitUniforms) {
    sharedSceneLitUniforms = uniformSceneLitSharedBuild();
  }
  return sharedSceneLitUniforms;
}

/**
 * Copies the shared scene light uniform references into a material uniform map.
 *
 * @param target Destination uniform map.
 */
export function uniformSceneLitSharedAttach(target: Record<string, THREE.IUniform>): void {
  Object.assign(target, uniformSceneLitSharedGet());
}

/**
 * Writes light records into the shared uniforms; records beyond the maximum are
 * ignored.
 *
 * @param records Lights to draw, most important first.
 */
export function uniformSceneLitSharedWrite(records: readonly ShadingLitLightRecord[]): void {
  const uniforms = uniformSceneLitSharedGet();
  const count = Math.min(records.length, SCENE_LIT_MAXIMUM_LIGHT_COUNT);
  for (let index = 0; index < count; index++) {
    const record = records[index];
    if (record) {
      uniformSceneLitSharedWriteOne(uniforms, index, record);
    }
  }
  uniformSceneLitSharedValue(uniforms, SCENE_LIT_UNIFORM_NAMES.count).value = count;
}

/**
 * Writes one light record into slot `index` of the shared arrays.
 *
 * @param uniforms Shared uniform dictionary.
 * @param index Slot index.
 * @param record Light to write.
 */
function uniformSceneLitSharedWriteOne(
  uniforms: Record<string, THREE.IUniform>,
  index: number,
  record: ShadingLitLightRecord,
): void {
  const position = record.position;
  const axis = record.axisTowardsLight;
  const radiusSquared = record.radius * record.radius;
  uniformSceneLitSharedVector(uniforms, SCENE_LIT_UNIFORM_NAMES.positionRadiusSquared, index).set(
    position.x,
    position.y,
    position.z,
    radiusSquared,
  );
  uniformSceneLitSharedWriteColor(uniforms, index, record);
  uniformSceneLitSharedVector(uniforms, SCENE_LIT_UNIFORM_NAMES.axisInnerCosine, index).set(
    axis.x,
    axis.y,
    axis.z,
    record.innerCosine,
  );
  (uniformSceneLitSharedValue(uniforms, SCENE_LIT_UNIFORM_NAMES.outerCosine).value as number[])[index] =
    record.outerCosine;
}

/**
 * Writes the linear color scaled by intensity and the packed falloff of one
 * light into slot `index`.
 *
 * @param uniforms Shared uniform dictionary.
 * @param index Slot index.
 * @param record Light to write.
 */
function uniformSceneLitSharedWriteColor(
  uniforms: Record<string, THREE.IUniform>,
  index: number,
  record: ShadingLitLightRecord,
): void {
  const color = record.colorLinear;
  const strength = record.intensity;
  uniformSceneLitSharedVector(uniforms, SCENE_LIT_UNIFORM_NAMES.colorFalloff, index).set(
    color.r * strength,
    color.g * strength,
    color.b * strength,
    record.falloffPacked,
  );
}

/**
 * Returns one shared uniform by name.
 *
 * @param uniforms Shared uniform dictionary.
 * @param name Uniform name.
 * @returns The uniform.
 */
function uniformSceneLitSharedValue(uniforms: Record<string, THREE.IUniform>, name: string): THREE.IUniform {
  const uniform = uniforms[name];
  if (!uniform) {
    throw new Error(`Missing scene lit uniform ${name}`);
  }
  return uniform;
}

/**
 * Returns slot `index` of a shared vec4 array uniform.
 *
 * @param uniforms Shared uniform dictionary.
 * @param name Uniform name of a vec4 array.
 * @param index Slot index.
 * @returns Vector stored in the slot.
 */
function uniformSceneLitSharedVector(
  uniforms: Record<string, THREE.IUniform>,
  name: string,
  index: number,
): THREE.Vector4 {
  const vector = (uniformSceneLitSharedValue(uniforms, name).value as THREE.Vector4[])[index];
  if (!vector) {
    throw new Error(`Scene lit slot ${index} out of range`);
  }
  return vector;
}

/**
 * Builds the shared uniform dictionary with zeroed light arrays.
 *
 * @returns Fresh uniform dictionary.
 */
function uniformSceneLitSharedBuild(): Record<string, THREE.IUniform> {
  const vectorArray = (): THREE.Vector4[] =>
    Array.from({ length: SCENE_LIT_MAXIMUM_LIGHT_COUNT }, () => new THREE.Vector4());
  return {
    [SCENE_LIT_UNIFORM_NAMES.count]: { value: 0 },
    [SCENE_LIT_UNIFORM_NAMES.ambient]: { value: SHADING_LIT_AMBIENT_LINEAR },
    [SCENE_LIT_UNIFORM_NAMES.positionRadiusSquared]: { value: vectorArray() },
    [SCENE_LIT_UNIFORM_NAMES.colorFalloff]: { value: vectorArray() },
    [SCENE_LIT_UNIFORM_NAMES.axisInnerCosine]: { value: vectorArray() },
    [SCENE_LIT_UNIFORM_NAMES.outerCosine]: { value: new Array<number>(SCENE_LIT_MAXIMUM_LIGHT_COUNT).fill(0) },
  };
}
