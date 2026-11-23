import * as THREE from 'three';
import { MaterialColorNeutral } from './material_color_neutral.js';
import { SHADER_CHUNK_PROJECTED_GRID } from './shader/chunk/shader_chunk_projected_grid.js';
import type { ShaderProgramBase } from './shader/generator/shader_program_base.js';
import { ShaderProgramGenerator } from './shader/generator/shader_program_generator.js';

/**
 * Builds the base shader program of a content material from its tint and albedo
 * map.
 */
export type ContentProgramFactory = (tint: THREE.Color, map: THREE.Texture) => ShaderProgramBase;

/** Shared 1×1 white map when a surface has no texture. */
let contentProgramWhiteMap: THREE.DataTexture | null = null;

/**
 * Returns a shared white texture for untextured content.
 *
 * @returns 1×1 white DataTexture.
 */
function contentProgramWhiteMapGet(): THREE.DataTexture {
  if (!contentProgramWhiteMap) {
    contentProgramWhiteMap = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    contentProgramWhiteMap.colorSpace = THREE.SRGBColorSpace;
    contentProgramWhiteMap.needsUpdate = true;
  }
  return contentProgramWhiteMap;
}

/**
 * Content shader material with a tint, an optional albedo map and the projected
 * surface grid; the lighting comes from the program it is built with.
 */
export class ContentProgramMaterial extends THREE.ShaderMaterial {
  readonly color: THREE.Color;
  private contentMap: THREE.Texture | null;

  /**
   * Builds the material from a program factory.
   *
   * @param programFactory Builds the lighting program from tint and map.
   * @param color Tint.
   * @param map Albedo map, or null for white.
   * @param side Face side to draw.
   */
  constructor(
    programFactory: ContentProgramFactory,
    color: THREE.ColorRepresentation = MaterialColorNeutral.white,
    map: THREE.Texture | null = null,
    side: THREE.Side = THREE.FrontSide,
  ) {
    const tint = new THREE.Color(color);
    const program = ShaderProgramGenerator.generate(programFactory(tint, map ?? contentProgramWhiteMapGet()), [
      SHADER_CHUNK_PROJECTED_GRID,
    ]);
    super({
      lights: false,
      toneMapped: false,
      side,
      uniforms: program.uniforms,
      vertexShader: program.vertexShader,
      fragmentShader: program.fragmentShader,
    });
    this.color = tint;
    this.contentMap = map;
  }

  /** @returns Current albedo map, or null when using the shared white map. */
  get map(): THREE.Texture | null {
    return this.contentMap;
  }

  /** @param texture Albedo map, or null for white. */
  set map(texture: THREE.Texture | null) {
    this.contentMap = texture;
    if (this.uniforms['map']) {
      this.uniforms['map'].value = texture ?? contentProgramWhiteMapGet();
    }
  }

  /**
   * Makes the material see-through with an opacity, or opaque again.
   *
   * @param opacity Opacity from zero to one, or null for an opaque material.
   */
  translucencySet(opacity: number | null): void {
    const isTranslucent = opacity !== null;
    this.transparent = isTranslucent;
    this.depthWrite = !isTranslucent;
    this.uniformValueSet('opacity', opacity ?? 1);
    this.uniformValueSet('translucency', isTranslucent ? 1 : 0);
  }

  /**
   * Returns the opacity of a see-through material.
   *
   * @returns Opacity from zero to one, or null when the material is opaque.
   */
  translucencyRead(): number | null {
    return this.transparent ? Number(this.uniforms['opacity']?.value ?? 1) : null;
  }

  /**
   * Writes a uniform value when the program has the uniform.
   *
   * @param name Uniform name.
   * @param value New value.
   */
  private uniformValueSet(name: string, value: number): void {
    const uniform = this.uniforms[name];
    if (uniform) {
      uniform.value = value;
    }
  }

  /** Keeps the diffuse uniform on the live color object. */
  override onBeforeRender(): void {
    if (this.uniforms['diffuse']) {
      this.uniforms['diffuse'].value = this.color;
    }
  }
}
