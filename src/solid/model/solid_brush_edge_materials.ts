import * as THREE from 'three';
import { Theme } from '@/theme.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';

/**
 * UserData flag marking a shared brush edge material (must not be disposed per
 * mesh).
 */
export const BRUSH_EDGE_SHARED_MATERIAL_KEY = 'isSharedBrushEdgeMaterial';

/**
 * UserData flag marking operation-colored edges on solid brush previews.
 * Distinct from content decorative edges (white Theme.boxEdgeColor outlines).
 */
export const SOLID_BRUSH_EDGE_USERDATA_KEY = 'isSolidBrushEdge';

/** UserData flag marking materials that support distance fade uniforms. */
export const BRUSH_EDGE_DISTANCE_FADE_KEY = 'brushEdgeDistanceFade';

/** UserData key storing the 2D wire color a shared edge material draws. */
export const BRUSH_EDGE_ORTHO_COLOR_KEY = 'brushEdgeOrthoColorHex';

/** UserData key storing the CSG operation a shared edge material tints for. */
const BRUSH_EDGE_OPERATION_KEY = 'brushEdgeOperation';

/** Distance where brush edges begin fading out in the perspective viewport. */
export const BRUSH_EDGE_FADE_NEAR = 28;

/**
 * Distance where brush edges are fully faded and culled in the perspective
 * viewport.
 */
export const BRUSH_EDGE_FADE_FAR = 85;

/** Opacity for depth-tested brush edges (3D). */
export const BRUSH_EDGE_FRONT_OPACITY = 0.88;

/** Near/far values that effectively disable distance fade (ortho, tests). */
const FADE_DISABLED_NEAR = 1e7;

/** Far plane for disabled distance fade. */
const FADE_DISABLED_FAR = 1e8;

/**
 * Vertex shader: projects line verts, computes distance fade for perspective
 * only and tells the fragment stage which projection is drawing. Three.js sets
 * projectionMatrix[2][3] to 0 for ortho and non-zero for perspective, so 2D
 * panes stay fully opaque while 3D still distance-fades.
 */
const EDGE_VERTEX_SHADER = `
  uniform float fadeNear;
  uniform float fadeFar;
  varying float vFade;
  varying float vPerspective;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    bool isPerspective = projectionMatrix[2][3] != 0.0;
    if (isPerspective) {
      float distanceFromCamera = length(mvPosition.xyz);
      vFade = 1.0 - smoothstep(fadeNear, fadeFar, distanceFromCamera);
      vPerspective = 1.0;
    } else {
      vFade = 1.0;
      vPerspective = 0.0;
    }
    gl_Position = projectionMatrix * mvPosition;
  }
`;

/**
 * Fragment shader: draws the operation color in perspective and the per-object
 * wire color in orthographic panes, multiplied by distance fade and base
 * opacity.
 */
const EDGE_FRAGMENT_SHADER = `
  uniform vec3 diffuse;
  uniform vec3 orthoDiffuse;
  uniform float opacity;
  varying float vFade;
  varying float vPerspective;

  void main() {
    float alpha = opacity * vFade;
    if (alpha < 0.012) discard;
    gl_FragColor = vec4(mix(orthoDiffuse, diffuse, vPerspective), alpha);
  }
`;

/**
 * Shared brush edge materials. One material exists per CSG operation and 2D
 * wire color: perspective panes draw the operation color, orthographic panes
 * the stable per-object wire color. Perspective uses depth testing so edges
 * behind solid geometry are not drawn; orthographic multi-view panes disable
 * depth so full wireframes remain readable.
 */
export class SolidBrushEdgeMaterials {
  private static materialsByKey = new Map<string, THREE.ShaderMaterial>();
  private static depthOcclusionEnabled = true;
  /** When set, all shared edge materials use this diffuse for one pane pass. */
  private static diffuseOverrideHex: number | null = null;

  /**
   * Returns the shared edge material for a CSG operation and 2D wire color.
   *
   * @param operation Brush CSG operation (3D edge color).
   * @param orthoColorHex Wire color the edges draw in orthographic panes.
   * @returns Shared edge material.
   */
  static getFrontMaterial(operation: SolidOperation, orthoColorHex: number): THREE.ShaderMaterial {
    const key = `${operation}|${orthoColorHex}`;
    const existing = this.materialsByKey.get(key);
    if (existing) return existing;
    const material = this.createMaterial(operation, orthoColorHex);
    this.materialsByKey.set(key, material);
    return material;
  }

  /**
   * Enables depth testing for perspective multi-view panes, or always-on-top
   * edges for orthographic 2D panes. Shared materials are toggled each scissor
   * pass because all panes draw the same world hierarchy.
   *
   * @param enabled True for 3D depth test; false for full-bright 2D edges.
   */
  static setDepthOcclusionEnabled(enabled: boolean): void {
    if (this.depthOcclusionEnabled === enabled) return;
    this.depthOcclusionEnabled = enabled;
    this.materialsByKey.forEach((material) => {
      this.applyDepthMode(material, enabled);
    });
  }

  /**
   * Forces every shared brush edge material to one diffuse color, in both
   * projections, for one pane pass.
   *
   * @param color Hex color.
   */
  static setDiffuseColorOverrideForRenderPass(color: number): void {
    this.diffuseOverrideHex = color;
    this.applyDiffuseToAllMaterials();
  }

  /**
   * Restores per-operation and per-object edge colors after a pane that used a
   * diffuse override.
   */
  static clearDiffuseColorOverrideForRenderPass(): void {
    if (this.diffuseOverrideHex === null) {
      return;
    }
    this.diffuseOverrideHex = null;
    this.applyDiffuseToAllMaterials();
  }

  /**
   * Returns whether shared edge materials currently use depth testing.
   *
   * @returns True when 3D depth testing is enabled.
   */
  static isDepthOcclusionEnabled(): boolean {
    return this.depthOcclusionEnabled;
  }

  /**
   * Returns whether a material is a shared brush edge material.
   *
   * @param material Candidate material.
   * @returns True when dispose paths must skip this material.
   */
  static isSharedMaterial(material: THREE.Material): boolean {
    return material.userData[BRUSH_EDGE_SHARED_MATERIAL_KEY] === true;
  }

  /**
   * Disables distance fade on a material.
   *
   * @param material Line material to update.
   */
  static disableDistanceFade(material: THREE.Material): void {
    if (material.userData[BRUSH_EDGE_DISTANCE_FADE_KEY] !== true) return;
    if (!(material instanceof THREE.ShaderMaterial)) return;
    const fadeNear = material.uniforms['fadeNear'];
    const fadeFar = material.uniforms['fadeFar'];
    if (fadeNear) fadeNear.value = FADE_DISABLED_NEAR;
    if (fadeFar) fadeFar.value = FADE_DISABLED_FAR;
  }

  /**
   * Prepares a brush edge material for orthographic multi-view. Disables
   * distance fade and depth testing so outlines stay visible from every axis
   * even when solid result depth would hide them.
   *
   * @param material Line material to update.
   */
  static prepareForOrthoClone(material: THREE.Material): void {
    this.disableDistanceFade(material);
    if (material.userData[BRUSH_EDGE_DISTANCE_FADE_KEY] !== true) return;
    material.depthTest = false;
    material.depthWrite = false;
    material.depthFunc = THREE.AlwaysDepth;
    material.needsUpdate = true;
  }

  /**
   * 3D edge color for a CSG operation.
   *
   * @param operation Solid operation.
   * @returns Hex color.
   */
  static edgeColorForOperation(operation: SolidOperation): number {
    if (operation === SolidOperation.Subtractive) return Theme.solidEdgeSubtractiveColor;
    if (operation === SolidOperation.Intersecting) return Theme.solidEdgeIntersectingColor;
    return Theme.solidEdgeAdditiveColor;
  }

  /**
   * Builds one shared distance-faded edge material.
   *
   * @param operation CSG operation for the 3D tint.
   * @param orthoColorHex Wire color of orthographic panes.
   * @returns Configured shader material.
   */
  private static createMaterial(operation: SolidOperation, orthoColorHex: number): THREE.ShaderMaterial {
    const material = new THREE.ShaderMaterial({
      uniforms: this.createUniforms(operation, orthoColorHex),
      vertexShader: EDGE_VERTEX_SHADER,
      fragmentShader: EDGE_FRAGMENT_SHADER,
      transparent: true,
      depthTest: this.depthOcclusionEnabled,
      depthWrite: false,
      depthFunc: this.depthOcclusionEnabled ? THREE.LessEqualDepth : THREE.AlwaysDepth,
      toneMapped: false,
    });
    material.userData[BRUSH_EDGE_SHARED_MATERIAL_KEY] = true;
    material.userData[BRUSH_EDGE_DISTANCE_FADE_KEY] = true;
    material.userData[BRUSH_EDGE_ORTHO_COLOR_KEY] = orthoColorHex;
    material.userData[BRUSH_EDGE_OPERATION_KEY] = operation;
    return material;
  }

  /**
   * Builds the uniform set of a shared edge material, honouring an active
   * diffuse override.
   *
   * @param operation CSG operation for the 3D tint.
   * @param orthoColorHex Wire color of orthographic panes.
   * @returns Uniform dictionary.
   */
  private static createUniforms(operation: SolidOperation, orthoColorHex: number): Record<string, THREE.IUniform> {
    return {
      diffuse: { value: new THREE.Color(this.diffuseOverrideHex ?? this.edgeColorForOperation(operation)) },
      orthoDiffuse: { value: new THREE.Color(this.diffuseOverrideHex ?? orthoColorHex) },
      opacity: { value: BRUSH_EDGE_FRONT_OPACITY },
      fadeNear: { value: BRUSH_EDGE_FADE_NEAR },
      fadeFar: { value: BRUSH_EDGE_FADE_FAR },
    };
  }

  /**
   * Applies depth-test settings for 3D occlusion or full-bright 2D.
   *
   * @param material Edge material to update.
   * @param depthOcclusionEnabled Whether 3D depth testing is active.
   */
  private static applyDepthMode(material: THREE.ShaderMaterial, depthOcclusionEnabled: boolean): void {
    material.depthTest = depthOcclusionEnabled;
    material.depthWrite = false;
    material.depthFunc = depthOcclusionEnabled ? THREE.LessEqualDepth : THREE.AlwaysDepth;
    material.needsUpdate = true;
  }

  /** Writes the override or the own colors onto every shared edge material. */
  private static applyDiffuseToAllMaterials(): void {
    this.materialsByKey.forEach((material) => {
      const operation = this.operationOfMaterial(material);
      const orthoColorHex = material.userData[BRUSH_EDGE_ORTHO_COLOR_KEY];
      this.uniformColorWrite(material, 'diffuse', this.diffuseOverrideHex ?? this.edgeColorForOperation(operation));
      if (typeof orthoColorHex === 'number') {
        this.uniformColorWrite(material, 'orthoDiffuse', this.diffuseOverrideHex ?? orthoColorHex);
      }
    });
  }

  /**
   * Reads the CSG operation a shared edge material was created for.
   *
   * @param material Shared edge material.
   * @returns Solid operation.
   */
  private static operationOfMaterial(material: THREE.ShaderMaterial): SolidOperation {
    const value = material.userData[BRUSH_EDGE_OPERATION_KEY];
    if (value === SolidOperation.Subtractive) return SolidOperation.Subtractive;
    if (value === SolidOperation.Intersecting) return SolidOperation.Intersecting;
    return SolidOperation.Additive;
  }

  /**
   * Writes a hex color into a color uniform of a material.
   *
   * @param material Shader material.
   * @param uniformName Name of the color uniform.
   * @param hex Hex color.
   */
  private static uniformColorWrite(material: THREE.ShaderMaterial, uniformName: string, hex: number): void {
    const uniform = material.uniforms[uniformName];
    if (uniform && uniform.value instanceof THREE.Color) {
      uniform.value.setHex(hex);
    }
  }
}
