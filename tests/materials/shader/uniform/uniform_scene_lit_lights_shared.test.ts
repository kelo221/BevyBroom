import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  SCENE_LIT_MAXIMUM_LIGHT_COUNT,
  SCENE_LIT_UNIFORM_NAMES,
  uniformSceneLitSharedAttach,
  uniformSceneLitSharedGet,
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
    axisTowardsLight: new THREE.Vector3(0, 1, 0),
    colorLinear: new THREE.Color(0.5, 0.25, 0.125),
    intensity: seed + 1,
    radius: seed + 3,
    falloffPacked: seed * 0.5,
    innerCosine: 0.9,
    outerCosine: 0.8,
  };
}

/**
 * Reads one vec4 slot of a shared array uniform.
 *
 * @param name Uniform name.
 * @param index Slot index.
 * @returns The stored vector.
 */
function slotRead(name: string, index: number): THREE.Vector4 | undefined {
  return (uniformSceneLitSharedGet()[name]?.value as THREE.Vector4[])[index];
}

/** The shared uniforms carry the scene lights to every Lit material at once. */
describe('uniform_scene_lit_lights_shared', () => {
  it('packs position with radius squared and color times intensity with falloff', () => {
    const record = recordCreate(2);
    uniformSceneLitSharedWrite([record]);
    const positionSlot = slotRead(SCENE_LIT_UNIFORM_NAMES.positionRadiusSquared, 0);
    const colorSlot = slotRead(SCENE_LIT_UNIFORM_NAMES.colorFalloff, 0);
    const axisSlot = slotRead(SCENE_LIT_UNIFORM_NAMES.axisInnerCosine, 0);
    const outer = uniformSceneLitSharedGet()[SCENE_LIT_UNIFORM_NAMES.outerCosine]?.value as number[];
    expect(positionSlot?.toArray()).toEqual([...record.position.toArray(), record.radius * record.radius]);
    expect(colorSlot?.x).toBeCloseTo(record.colorLinear.r * record.intensity);
    expect(colorSlot?.w).toBe(record.falloffPacked);
    expect(axisSlot?.toArray()).toEqual([...record.axisTowardsLight.toArray(), record.innerCosine]);
    expect(outer[0]).toBe(record.outerCosine);
    expect(uniformSceneLitSharedGet()[SCENE_LIT_UNIFORM_NAMES.count]?.value).toBe(1);
  });

  it('caps the light count at the maximum the shader holds', () => {
    const records = Array.from({ length: SCENE_LIT_MAXIMUM_LIGHT_COUNT + 5 }, (_, index) => recordCreate(index));
    uniformSceneLitSharedWrite(records);
    expect(uniformSceneLitSharedGet()[SCENE_LIT_UNIFORM_NAMES.count]?.value).toBe(SCENE_LIT_MAXIMUM_LIGHT_COUNT);
    uniformSceneLitSharedWrite([]);
    expect(uniformSceneLitSharedGet()[SCENE_LIT_UNIFORM_NAMES.count]?.value).toBe(0);
  });

  it('attaches the same uniform objects to every material map with the default ambient', () => {
    const first: Record<string, THREE.IUniform> = {};
    const second: Record<string, THREE.IUniform> = {};
    uniformSceneLitSharedAttach(first);
    uniformSceneLitSharedAttach(second);
    expect(first[SCENE_LIT_UNIFORM_NAMES.count]).toBe(second[SCENE_LIT_UNIFORM_NAMES.count]);
    expect(first[SCENE_LIT_UNIFORM_NAMES.ambient]?.value).toBeCloseTo(SHADING_LIT_AMBIENT_LINEAR);
  });
});
