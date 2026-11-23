import type * as THREE from 'three';
import { ShaderProgramTranslucency } from './shader_program_translucency.js';
import type { ShaderProgramBase } from '../generator/shader_program_base.js';
import {
  SCENE_LIT_MAXIMUM_LIGHT_COUNT,
  SCENE_LIT_TEXEL_COLUMNS,
  SCENE_LIT_UNIFORM_NAMES,
  uniformSceneLitSharedAttach,
} from '../uniform/uniform_scene_lit_lights_shared.js';
import {
  SHADING_LIT_CONE_HARD_EDGE_EPSILON,
  SHADING_LIT_TUBE_MIN_ANGLE,
} from '@/viewports/shading/lit/shading_lit_light_math.js';

/**
 * Shader program that lights content with the scene's authored point, spot and
 * tube lights using the game renderer's attenuation and cone formulas.
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
   * Returns diffuse, map and see-through uniforms plus the shared scene light
   * uniforms; a new program is opaque.
   *
   * @returns Base uniform dictionary.
   */
  baseUniforms(): Record<string, THREE.IUniform> {
    const uniforms: Record<string, THREE.IUniform> = {
      diffuse: { value: this.tint },
      map: { value: this.map },
      ...ShaderProgramTranslucency.uniforms(),
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
    return /* glsl */ `
      uniform vec3 diffuse;
      uniform sampler2D map;
      ${ShaderProgramTranslucency.fragmentDeclarations()}
      uniform int ${names.count};
      uniform float ${names.ambient};
      uniform highp sampler2D ${names.texture};
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
    return (
      shaderProgramContentSceneLitFormulaHelpers() +
      shaderProgramContentSceneLitTubeHelpers() +
      shaderProgramContentSceneLitGatherHelper()
    );
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
      vec4 surfaceTexel = texture2D(map, vUv);
      vec3 ${linearColorVariableName} = surfaceTexel.rgb * diffuse * sceneLitLight;
    `;
  }

  /**
   * Writes linear lit color through Three.js output encoding, opaque unless the
   * translucency uniform blends in the opacity times the map's alpha.
   *
   * @param linearColorVariableName Final linear color variable.
   * @returns Fragment output statements.
   */
  fragmentWriteOutput(linearColorVariableName: string): string {
    return ShaderProgramTranslucency.fragmentWriteOutput(linearColorVariableName, 'surfaceTexel');
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
 * Builds the GLSL tube helpers matching the game renderer: nearest point on the
 * tube and the mean cosine over the part above the surface's horizon.
 *
 * @returns Fragment helper GLSL.
 */
function shaderProgramContentSceneLitTubeHelpers(): string {
  return /* glsl */ `
    vec3 sceneLitSafeNormalize(vec3 value) {
      return value * inversesqrt(max(dot(value, value), 1e-20));
    }

    vec3 sceneLitTubeNearestPoint(vec3 center, vec3 axis, float halfLength, vec3 worldPosition) {
      return center + axis * clamp(dot(worldPosition - center, axis), -halfLength, halfLength);
    }

    vec3 sceneLitArcVector(vec3 first, vec3 second) {
      return (first + second) * (length(cross(first, second)) / max(1.0 + dot(first, second), 1e-6));
    }

    float sceneLitTubeCosine(vec3 center, vec3 axis, float halfLength, vec3 worldPosition, vec3 normalUnit) {
      vec3 start = center - axis * halfLength - worldPosition;
      vec3 end = center + axis * halfLength - worldPosition;
      vec3 startUnit = sceneLitSafeNormalize(start);
      vec3 endUnit = sceneLitSafeNormalize(end);
      float angle = atan(length(cross(startUnit, endUnit)), dot(startUnit, endUnit));
      if (angle < ${SHADING_LIT_TUBE_MIN_ANGLE.toExponential()}) return max(dot(normalUnit, sceneLitSafeNormalize(center - worldPosition)), 0.0);
      float startHeight = dot(normalUnit, start);
      float endHeight = dot(normalUnit, end);
      if (startHeight <= 0.0 && endHeight <= 0.0) return 0.0;
      vec3 crossing = mix(start, end, startHeight / (startHeight - endHeight));
      if (startHeight < 0.0) start = crossing;
      else if (endHeight < 0.0) end = crossing;
      vec3 arc = sceneLitArcVector(sceneLitSafeNormalize(start), sceneLitSafeNormalize(end));
      return max(dot(normalUnit, arc) / angle, 0.0);
    }
  `;
}

/**
 * Builds the GLSL loop that sums the diffuse light of every scene light read
 * from the light texture.
 *
 * @returns Fragment helper GLSL.
 */
function shaderProgramContentSceneLitGatherHelper(): string {
  const names = SCENE_LIT_UNIFORM_NAMES;
  const columns = SCENE_LIT_TEXEL_COLUMNS;
  return /* glsl */ `
    vec4 sceneLitTexel(int lightIndex, int column) {
      return texelFetch(${names.texture}, ivec2(column, lightIndex), 0);
    }

    vec3 sceneLitLightDiffuse(int index, vec3 worldPosition, vec3 normalUnit) {
      vec4 positionReachSquared = sceneLitTexel(index, ${columns.positionReachSquared});
      vec4 shape = sceneLitTexel(index, ${columns.outerCosineTubeHalfLength});
      vec4 axisInnerCosine = sceneLitTexel(index, ${columns.axisInnerCosine});
      bool isTube = shape.y > 0.0;
      vec3 nearest = isTube ? sceneLitTubeNearestPoint(positionReachSquared.xyz, axisInnerCosine.xyz, shape.y, worldPosition) : positionReachSquared.xyz;
      vec3 toLight = nearest - worldPosition;
      float distanceSquared = dot(toLight, toLight);
      if (distanceSquared > positionReachSquared.w) return vec3(0.0);
      vec3 direction = toLight * inversesqrt(max(distanceSquared, 1e-20));
      float facing = isTube ? sceneLitTubeCosine(positionReachSquared.xyz, axisInnerCosine.xyz, shape.y, worldPosition, normalUnit) : max(dot(normalUnit, direction), 0.0);
      float cone = isTube ? 1.0 : sceneLitCone(dot(direction, axisInnerCosine.xyz), axisInnerCosine.w, shape.x);
      vec4 colorFalloff = sceneLitTexel(index, ${columns.colorFalloff});
      float attenuation = sceneLitAttenuation(positionReachSquared.w, colorFalloff.w, distanceSquared);
      return colorFalloff.rgb * (attenuation * facing * cone);
    }

    vec3 sceneLitGather(vec3 worldPosition, vec3 normalUnit) {
      vec3 sum = vec3(0.0);
      for (int index = 0; index < ${SCENE_LIT_MAXIMUM_LIGHT_COUNT}; index++) {
        if (index >= ${names.count}) break;
        sum += sceneLitLightDiffuse(index, worldPosition, normalUnit);
      }
      return sum;
    }
  `;
}
