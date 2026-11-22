import type * as THREE from 'three';
import { ContentProgramMaterial } from './content_program_material.js';
import { MaterialColorNeutral } from './material_color_neutral.js';
import { ShaderProgramContentViewLit } from './shader/program/shader_program_content_view_lit.js';

export { CONTENT_VIEW_LIT_AMBIENT } from './content_view_lit_constants.js';

/** UserData key marking content view-lit materials. */
export const CONTENT_VIEW_LIT_USERDATA_KEY = 'isContentViewLitMaterial';

/**
 * Content material with camera-locked studio viewport lighting and optional
 * projected surface grid (shared chunk uniforms, no overlay meshes).
 */
export class ContentViewLitMaterial extends ContentProgramMaterial {
  /**
   * @param color Tint.
   * @param map Albedo map, or null for white.
   * @param options Side only.
   */
  constructor(
    color: THREE.ColorRepresentation = MaterialColorNeutral.white,
    map: THREE.Texture | null = null,
    options: { side?: THREE.Side } = {},
  ) {
    super((tint, resolvedMap) => new ShaderProgramContentViewLit(tint, resolvedMap), color, map, options.side);
    this.userData[CONTENT_VIEW_LIT_USERDATA_KEY] = true;
    this.name = 'content_view_lit';
  }

  /** API compatibility with older content materials. */
  get flatShading(): boolean {
    return true;
  }
}

/**
 * @param material Candidate material.
 * @returns True when this is a content view-lit material.
 */
export function isContentViewLitMaterial(material: THREE.Material): material is ContentViewLitMaterial {
  return material.userData[CONTENT_VIEW_LIT_USERDATA_KEY] === true;
}

/**
 * @param color Hex tint.
 * @param map Optional albedo map.
 * @param options Side only.
 * @returns Content view-lit material.
 */
export function createContentViewLitMaterial(
  color: number,
  map: THREE.Texture | null = null,
  options: { flatShading?: boolean; side?: THREE.Side } = {},
): ContentViewLitMaterial {
  if (options.side !== undefined) {
    return new ContentViewLitMaterial(color, map, { side: options.side });
  }
  return new ContentViewLitMaterial(color, map);
}
