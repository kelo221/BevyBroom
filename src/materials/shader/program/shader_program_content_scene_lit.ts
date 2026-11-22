import type * as THREE from 'three';
import type { ShaderProgramBase } from '../generator/shader_program_base.js';
import {
  SCENE_LIT_MAXIMUM_LIGHT_COUNT,
  SCENE_LIT_UNIFORM_NAMES,
  uniformSceneLitSharedAttach,
} from '../uniform/uniform_scene_lit_lights_shared.js';
import { SHADING_LIT_CONE_HARD_EDGE_EPSILON } from '@/viewports/shading/lit/shading_lit_light_math.js';

/**
 * Shader program that lights content with the scene's authored point and spot
 * lights using the game renderer's attenuation and cone formulas.
 */
export class ShaderProgramContentSceneLit implements ShaderProgramBase {
  private readonly tint: THREE.Color;
  private readonly map: THREE.Texture;

  /**
   * Stores the diffuse tint color and albedo map for this program.
   *
   * @param tint Diffuse tint color.
   * @param map Albedo texture.
   */
  constructor(tint: THREE.Color, map: THREE.Texture) {
    this.tint = tint;
    this.map = map;
  }

  /**
   * Returns diffuse and map uniforms plus the shared scene light uniforms.
   *
   * @returns Base uniform dictionary.
   */
  baseUniforms(): Record<string, THREE.IUniform> {
    const uniforms: Record<string, THREE.IUniform> = {
      diffuse: { value: this.tint },
      map: { value: this.map },
    };
    uniformSceneLitSharedAttach(uniforms);
    return uniforms;
  }

  /**
   * Declares UV and world-space position and normal varyings.
   *
   * @returns Vertex declarations.
   */
  vertexDeclarations(): string {
    return /* glsl */ `
      varying vec2 vUv;
      varying vec3 vSceneLitWorldPosition;
      varying vec3 vSceneLitWorldNormal;
    `;
  }

  /**
   * Writes UV, world position and the world normal.
   *
   * @returns Vertex main statements.
   */
  vertexMainStatements(): string {
    return /* glsl */ `
      vUv = uv;
      vSceneLitWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
      vSceneLitWorldNormal = normalize(transpose(inverse(mat3(modelMatrix))) * normal);
    `;
  }

  /**
   * Writes clip-space position.
   *
   * @returns Vertex position statements.
   */
  vertexPositionStatements(): string {
    return /* glsl */ `
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    `;
  }

  /**
   * Declares albedo, scene light uniforms and varyings for the fragment stage.
   *
   * @returns Fragment declarations.
   */
  fragmentDeclarations(): string {
    const names = SCENE_LIT_UNIFORM_NAMES;
    const count = SCENE_LIT_MAXIMUM_LIGHT_COUNT;
    return /* glsl */ `
      uniform vec3 diffuse;
      uniform sampler2D map;
      uniform int ${names.count};
      uniform float ${names.ambient};
      uniform vec4 ${names.positionRadiusSquared}[${count}];
      uniform vec4 ${names.colorFalloff}[${count}];
      uniform vec4 ${names.axisInnerCosine}[${count}];
      uniform float ${names.outerCosine}[${count}];
      varying vec2 vUv;
      varying vec3 vSceneLitWorldPosition;
      varying vec3 vSceneLitWorldNormal;
    `;
  }

  /**
   * Returns the attenuation, cone and light gathering helpers.
   *
   * @returns Fragment helper GLSL.
   */
  fragmentHelperFunctions(): string {
    return shaderProgramContentSceneLitFormulaHelpers() + shaderProgramContentSceneLitGatherHelper();
  }

  /**
   * Multiplies albedo by ambient plus gathered scene light into linearColor.
   *
   * @param linearColorVariableName Output variable name.
   * @returns Fragment statements.
   */
  fragmentComputeLinearColor(linearColorVariableName: string): string {
    return /* glsl */ `
      vec3 sceneLitNormal = normalize(vSceneLitWorldNormal) * (gl_FrontFacing ? 1.0 : -1.0);
      vec3 sceneLitLight = vec3(${SCENE_LIT_UNIFORM_NAMES.ambient}) + sceneLitGather(vSceneLitWorldPosition, sceneLitNormal);
      vec3 ${linearColorVariableName} = texture2D(map, vUv).rgb * diffuse * sceneLitLight;
    `;
  }

  /**
   * Writes linear lit color through Three.js output encoding.
   *
   * @param linearColorVariableName Final linear color variable.
   * @returns Fragment output statements.
   */
  fragmentWriteOutput(linearColorVariableName: string): string {
    return /* glsl */ `
      gl_FragColor = linearToOutputTexel(vec4(${linearColorVariableName}, 1.0));
    `;
  }
}

/**
 * Builds the GLSL attenuation and cone functions matching the game renderer.
 *
 * @returns Fragment helper GLSL.
 */
function shaderProgramContentSceneLitFormulaHelpers(): string {
  return /* glsl */ `
    float sceneLitAttenuation(float radiusSquared, float falloff, float distanceSquared) {
      float ratio = clamp(distanceSquared / radiusSquared, 0.0, 1.0);
      return (1.0 - ratio) * (1.0 - ratio) / (1.0 + falloff * ratio);
    }

    float sceneLitCone(float theta, float innerCosine, float outerCosine) {
      if (theta <= outerCosine) return 0.0;
      float edgeWidth = innerCosine - outerCosine;
      if (abs(edgeWidth) <= ${SHADING_LIT_CONE_HARD_EDGE_EPSILON.toExponential()}) return theta >= innerCosine ? 1.0 : 0.0;
      return clamp((theta - outerCosine) / edgeWidth, 0.0, 1.0);
    }
  `;
}

/**
 * Builds the GLSL loop that sums the Lambert light of every scene light.
 *
 * @returns Fragment helper GLSL.
 */
function shaderProgramContentSceneLitGatherHelper(): string {
  const names = SCENE_LIT_UNIFORM_NAMES;
  return /* glsl */ `
    vec3 sceneLitGather(vec3 worldPosition, vec3 normalUnit) {
      vec3 sum = vec3(0.0);
      for (int index = 0; index < ${SCENE_LIT_MAXIMUM_LIGHT_COUNT}; index++) {
        if (index >= ${names.count}) break;
        vec4 positionRadiusSquared = ${names.positionRadiusSquared}[index];
        vec4 colorFalloff = ${names.colorFalloff}[index];
        vec4 axisInnerCosine = ${names.axisInnerCosine}[index];
        vec3 toLight = positionRadiusSquared.xyz - worldPosition;
        float distanceSquared = dot(toLight, toLight);
        if (distanceSquared >= positionRadiusSquared.w) continue;
        vec3 direction = toLight * inversesqrt(max(distanceSquared, 1e-8));
        float lambert = max(dot(normalUnit, direction), 0.0);
        float cone = sceneLitCone(dot(direction, axisInnerCosine.xyz), axisInnerCosine.w, ${names.outerCosine}[index]);
        float attenuation = sceneLitAttenuation(positionRadiusSquared.w, colorFalloff.w, distanceSquared);
        sum += colorFalloff.rgb * (attenuation * lambert * cone);
      }
      return sum;
    }
  `;
}
