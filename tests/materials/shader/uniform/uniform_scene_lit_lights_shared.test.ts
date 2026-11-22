import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  SCENE_LIT_MAXIMUM_LIGHT_COUNT,
  SCENE_LIT_TEXEL_COLUMNS,
  SCENE_LIT_TEXELS_PER_LIGHT,
  SCENE_LIT_UNIFORM_NAMES,
  uniformSceneLitSharedAttach,
  uniformSceneLitSharedGet,
  uniformSceneLitSharedTexelRead,
  uniformSceneLitSharedTexture,
  uniformSceneLitSharedWrite,
} from '@/materials/shader/uniform/uniform_scene_lit_lights_shared.js';
import type { ShadingLitLightRecord } from '@/viewports/shading/lit/shading_lit_light_record.js';
import { SHADING_LIT_AMBIENT_LINEAR } from '@/viewports/shading/lit/shading_lit_light_math.js';

/**
 * Builds a light record with distinct values in every field.
 *
 * @param seed Number that makes this record's values unique.
 * @returns Light record.
 */
function recordCreate(seed: number): ShadingLitLightRecord {
  return {
    position: new THREE.Vector3(seed, seed + 1, seed + 2),
    axis: new THREE.Vector3(0, 1, 0),
    colorLinear: new THREE.Color(0.5, 0.25, 0.125),
    intensity: seed + 1,
    radius: seed + 4,
    reach: seed + 3,
    falloffPacked: seed * 0.5,
    innerCosine: 0.875,
    outerCosine: 0.75,
    tubeHalfLength: 0.5,
  };
}

/**
 * Reads the light count the shared uniforms hold.
 *
 * @returns Light count.
 */
function countRead(): unknown {
  return uniformSceneLitSharedGet()[SCENE_LIT_UNIFORM_NAMES.count]?.value;
}

/**
 * The shared light texture carries the scene lights to every Lit material at
 * once, one row of texels per light.
 */
describe('uniform_scene_lit_lights_shared', () => {
  it('packs every field of a record into its row of the light texture', () => {
    const record = recordCreate(2);
    const columns = SCENE_LIT_TEXEL_COLUMNS;
    uniformSceneLitSharedWrite([recordCreate(1), record]);
    expect(uniformSceneLitSharedTexelRead(1, columns.positionReachSquared)).toEqual([
      ...record.position.toArray(),
      record.reach * record.reach,
    ]);
    const colorTexel = uniformSceneLitSharedTexelRead(1, columns.colorFalloff);
    expect(colorTexel[0]).toBeCloseTo(record.colorLinear.r * record.intensity);
    expect(colorTexel[3]).toBeCloseTo(record.falloffPacked);
    expect(uniformSceneLitSharedTexelRead(1, columns.axisInnerCosine)).toEqual([
      ...record.axis.toArray(),
      record.innerCosine,
    ]);
    expect(uniformSceneLitSharedTexelRead(1, columns.outerCosineTubeHalfLength).slice(0, 2)).toEqual([
      record.outerCosine,
      record.tubeHalfLength,
    ]);
    expect(countRead()).toBe(2);
  });

  it('sizes the float texture to hold the maximum light count with nearest sampling', () => {
    const texture = uniformSceneLitSharedTexture();
    expect(texture.image.width).toBe(SCENE_LIT_TEXELS_PER_LIGHT);
    expect(texture.image.height).toBe(SCENE_LIT_MAXIMUM_LIGHT_COUNT);
    expect(texture.type).toBe(THREE.FloatType);
    expect(texture.magFilter).toBe(THREE.NearestFilter);
  });

  it('caps the light count at the maximum the texture holds and flags an upload', () => {
    const texture = uniformSceneLitSharedTexture();
    const versionBefore = texture.version;
    const records = Array.from({ length: SCENE_LIT_MAXIMUM_LIGHT_COUNT + 5 }, (_, index) => recordCreate(index));
    uniformSceneLitSharedWrite(records);
    expect(countRead()).toBe(SCENE_LIT_MAXIMUM_LIGHT_COUNT);
    expect(texture.version).toBeGreaterThan(versionBefore);
    uniformSceneLitSharedWrite([]);
    expect(countRead()).toBe(0);
  });

  it('attaches the same uniform objects to every material map with the default ambient', () => {
    const first: Record<string, THREE.IUniform> = {};
    const second: Record<string, THREE.IUniform> = {};
    uniformSceneLitSharedAttach(first);
    uniformSceneLitSharedAttach(second);
    expect(first[SCENE_LIT_UNIFORM_NAMES.texture]).toBe(second[SCENE_LIT_UNIFORM_NAMES.texture]);
    expect(first[SCENE_LIT_UNIFORM_NAMES.ambient]?.value).toBeCloseTo(SHADING_LIT_AMBIENT_LINEAR);
  });
});
