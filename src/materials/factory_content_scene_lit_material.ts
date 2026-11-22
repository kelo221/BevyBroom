import type * as THREE from 'three';
import { ContentProgramMaterial } from './content_program_material.js';
import { ShaderProgramContentSceneLit } from './shader/program/shader_program_content_scene_lit.js';

/**
 * Content material lit by the scene's authored point and spot lights with the
 * game renderer's attenuation and cone formulas, plus the projected grid.
 */
export class ContentSceneLitMaterial extends ContentProgramMaterial {
  /**
   * @param color Tint.
   * @param map Albedo map, or null for white.
   * @param side Face side to draw.
   */
  constructor(color: THREE.ColorRepresentation, map: THREE.Texture | null, side: THREE.Side) {
    super((tint, resolvedMap) => new ShaderProgramContentSceneLit(tint, resolvedMap), color, map, side);
    this.name = 'content_scene_lit';
  }
}
