import type * as THREE from 'three';

/**
 * GLSL pieces that let a content shader program be see-through: an opacity and
 * a switch that blends it with the map's alpha into the output alpha. A program
 * is opaque until a material turns the switch on.
 */
export class ShaderProgramTranslucency {
  /**
   * Returns the opacity and switch uniforms of an opaque program.
   *
   * @returns Uniforms to merge into a program's base uniforms.
   */
  static uniforms(): Record<string, THREE.IUniform> {
    return { opacity: { value: 1 }, translucency: { value: 0 } };
  }

  /**
   * Returns the fragment declarations of the uniforms.
   *
   * @returns GLSL declarations.
   */
  static fragmentDeclarations(): string {
    return /* glsl */ `
      uniform float opacity;
      uniform float translucency;
    `;
  }

  /**
   * Returns the statement that writes a color with the see-through alpha.
   *
   * @param linearColorVariableName Final linear color variable.
   * @param texelVariableName Variable holding the sampled albedo map texel.
   * @returns Fragment output statements.
   */
  static fragmentWriteOutput(linearColorVariableName: string, texelVariableName: string): string {
    return /* glsl */ `
      float surfaceAlpha = mix(1.0, opacity * ${texelVariableName}.a, translucency);
      gl_FragColor = linearToOutputTexel(vec4(${linearColorVariableName}, surfaceAlpha));
    `;
  }
}
