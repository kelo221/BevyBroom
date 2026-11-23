import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ContentSceneLitMaterial } from '@/materials/factory_content_scene_lit_material.js';
import { ContentProgramMaterial } from '@/materials/content_program_material.js';
import {
  SCENE_LIT_MAXIMUM_LIGHT_COUNT,
  SCENE_LIT_UNIFORM_NAMES,
  uniformSceneLitSharedGet,
} from '@/materials/shader/uniform/uniform_scene_lit_lights_shared.js';

/**
 * The scene-lit content material lights surfaces from the shared scene light
 * uniforms with the game renderer's formulas and keeps the projected grid.
 */
describe('ContentSceneLitMaterial', () => {
  it('shares the scene light uniforms and keeps tint, map and side', () => {
    const texture = new THREE.Texture();
    const material = new ContentSceneLitMaterial(0x336699, texture, THREE.DoubleSide);
    expect(material).toBeInstanceOf(ContentProgramMaterial);
    expect(material.color.getHex()).toBe(0x336699);
    expect(material.map).toBe(texture);
    expect(material.uniforms['map']?.value).toBe(texture);
    expect(material.side).toBe(THREE.DoubleSide);
    expect(material.uniforms[SCENE_LIT_UNIFORM_NAMES.count]).toBe(
      uniformSceneLitSharedGet()[SCENE_LIT_UNIFORM_NAMES.count],
    );
    expect(material.uniforms['projectedGridEnabled']).toBeDefined();
    expect(material.toneMapped).toBe(false);
    material.dispose();
    texture.dispose();
  });

  it('loops over the light texture up to the maximum and evaluates attenuation, cone, tube and Lambert', () => {
    const material = new ContentSceneLitMaterial(0xffffff, null, THREE.FrontSide);
    const shader = material.fragmentShader;
    expect(shader).toContain(`sampler2D ${SCENE_LIT_UNIFORM_NAMES.texture}`);
    expect(shader).toContain(`index < ${SCENE_LIT_MAXIMUM_LIGHT_COUNT}`);
    expect(shader).toContain('sceneLitTubeCosine');
    expect(shader).toContain('sceneLitTubeNearestPoint');
    expect(shader).toContain('sceneLitAttenuation');
    expect(shader).toContain('sceneLitCone');
    expect(shader).toContain('max(dot(normalUnit, direction), 0.0)');
    expect(shader).toContain('evaluateProjectedGridLineColor');
    expect(shader.split('linearToOutputTexel').length - 1).toBe(1);
    expect(material.uniforms['map']?.value).toBeInstanceOf(THREE.DataTexture);
    material.dispose();
  });

  it('starts opaque and blends the map alpha with an opacity once made see-through', () => {
    const material = new ContentSceneLitMaterial(0xffffff, null, THREE.FrontSide);
    expect(material.fragmentShader).toContain('surfaceAlpha');
    expect(material.translucencyRead()).toBeNull();
    material.translucencySet(0.5);
    expect(material.transparent).toBe(true);
    expect(material.translucencyRead()).toBeCloseTo(0.5);
    material.dispose();
  });
});
