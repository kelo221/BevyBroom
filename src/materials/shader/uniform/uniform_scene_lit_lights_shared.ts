import * as THREE from 'three';
import type { ShadingLitLightRecord } from '@/viewports/shading/lit/shading_lit_light_record.js';
import { SHADING_LIT_AMBIENT_LINEAR } from '@/viewports/shading/lit/shading_lit_light_math.js';

/** Most lights one Lit shading pass draws: the rows of the light texture. */
export const SCENE_LIT_MAXIMUM_LIGHT_COUNT = 1024;

/** Texels each light uses in its row of the light texture. */
export const SCENE_LIT_TEXELS_PER_LIGHT = 4;

/** Floats in one texel of the light texture. */
const SCENE_LIT_FLOATS_PER_TEXEL = 4;

/** Uniform names of the shared scene light data. */
export const SCENE_LIT_UNIFORM_NAMES = {
  count: 'sceneLitLightCount',
  ambient: 'sceneLitAmbient',
  texture: 'sceneLitLightTexture',
} as const;

/**
 * Texel columns of one light row: position with reach squared, color times
 * intensity with packed falloff, axis with inner cone cosine, and outer cone
 * cosine with tube half length.
 */
export const SCENE_LIT_TEXEL_COLUMNS = {
  positionReachSquared: 0,
  colorFalloff: 1,
  axisInnerCosine: 2,
  outerCosineTubeHalfLength: 3,
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
 * Returns the shared light texture.
 *
 * @returns Float texture with one row per light.
 */
export function uniformSceneLitSharedTexture(): THREE.DataTexture {
  return uniformSceneLitSharedValue(SCENE_LIT_UNIFORM_NAMES.texture).value as THREE.DataTexture;
}

/**
 * Writes light records into the shared light texture; records beyond the
 * maximum are ignored.
 *
 * @param records Lights to draw, most important first.
 */
export function uniformSceneLitSharedWrite(records: readonly ShadingLitLightRecord[]): void {
  const texture = uniformSceneLitSharedTexture();
  const data = texture.image.data as Float32Array;
  const count = Math.min(records.length, SCENE_LIT_MAXIMUM_LIGHT_COUNT);
  for (let index = 0; index < count; index++) {
    const record = records[index];
    if (record) {
      uniformSceneLitSharedWriteRow(data, index, record);
    }
  }
  texture.needsUpdate = true;
  uniformSceneLitSharedValue(SCENE_LIT_UNIFORM_NAMES.count).value = count;
}

/**
 * Reads one texel of a light row, for inspection.
 *
 * @param lightIndex Light row.
 * @param column Texel column from {@link SCENE_LIT_TEXEL_COLUMNS}.
 * @returns The four floats of the texel.
 */
export function uniformSceneLitSharedTexelRead(lightIndex: number, column: number): number[] {
  const data = uniformSceneLitSharedTexture().image.data as Float32Array;
  const start = uniformSceneLitSharedTexelOffset(lightIndex, column);
  return Array.from(data.subarray(start, start + SCENE_LIT_FLOATS_PER_TEXEL));
}

/**
 * Writes the four texels of one light row.
 *
 * @param data Texture data.
 * @param index Light row.
 * @param record Light to write.
 */
function uniformSceneLitSharedWriteRow(data: Float32Array, index: number, record: ShadingLitLightRecord): void {
  const columns = SCENE_LIT_TEXEL_COLUMNS;
  const { position, axis, colorLinear: color, intensity } = record;
  const write = (column: number, values: readonly number[]): void => {
    data.set(values, uniformSceneLitSharedTexelOffset(index, column));
  };
  write(columns.positionReachSquared, [position.x, position.y, position.z, record.reach * record.reach]);
  write(columns.colorFalloff, [color.r * intensity, color.g * intensity, color.b * intensity, record.falloffPacked]);
  write(columns.axisInnerCosine, [axis.x, axis.y, axis.z, record.innerCosine]);
  write(columns.outerCosineTubeHalfLength, [record.outerCosine, record.tubeHalfLength, 0, 0]);
}

/**
 * Returns the float offset of a texel in the texture data.
 *
 * @param lightIndex Light row.
 * @param column Texel column.
 * @returns Offset into the data array.
 */
function uniformSceneLitSharedTexelOffset(lightIndex: number, column: number): number {
  return (lightIndex * SCENE_LIT_TEXELS_PER_LIGHT + column) * SCENE_LIT_FLOATS_PER_TEXEL;
}

/**
 * Returns one shared uniform by name.
 *
 * @param name Uniform name.
 * @returns The uniform.
 */
function uniformSceneLitSharedValue(name: string): THREE.IUniform {
  const uniform = uniformSceneLitSharedGet()[name];
  if (!uniform) {
    throw new Error(`Missing scene lit uniform ${name}`);
  }
  return uniform;
}

/**
 * Builds the float texture holding one row of texels per light.
 *
 * @returns Zeroed light texture with nearest sampling.
 */
function uniformSceneLitSharedTextureBuild(): THREE.DataTexture {
  const floatCount = SCENE_LIT_MAXIMUM_LIGHT_COUNT * SCENE_LIT_TEXELS_PER_LIGHT * SCENE_LIT_FLOATS_PER_TEXEL;
  const texture = new THREE.DataTexture(
    new Float32Array(floatCount),
    SCENE_LIT_TEXELS_PER_LIGHT,
    SCENE_LIT_MAXIMUM_LIGHT_COUNT,
    THREE.RGBAFormat,
    THREE.FloatType,
  );
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Builds the shared uniform dictionary with an empty light texture.
 *
 * @returns Fresh uniform dictionary.
 */
function uniformSceneLitSharedBuild(): Record<string, THREE.IUniform> {
  return {
    [SCENE_LIT_UNIFORM_NAMES.count]: { value: 0 },
    [SCENE_LIT_UNIFORM_NAMES.ambient]: { value: SHADING_LIT_AMBIENT_LINEAR },
    [SCENE_LIT_UNIFORM_NAMES.texture]: { value: uniformSceneLitSharedTextureBuild() },
  };
}
