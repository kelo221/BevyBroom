import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  SolidBrushEdgeMaterials,
  BRUSH_EDGE_FADE_NEAR,
  BRUSH_EDGE_FADE_FAR,
  BRUSH_EDGE_FRONT_OPACITY,
  BRUSH_EDGE_SHARED_MATERIAL_KEY,
  BRUSH_EDGE_DISTANCE_FADE_KEY,
  BRUSH_EDGE_ORTHO_COLOR_KEY,
} from '@/solid/model/solid_brush_edge_materials.js';
import { Theme } from '@/theme.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';
import { ViewportObjectWireColor } from '@/viewports/shading/viewport_object_wire_color.js';

/** Palette wire color the tests request shared edge materials for. */
const TEST_WIRE_COLOR = ViewportObjectWireColor.colorFromPaletteIndex(0);

/** Unit tests for shared distance-faded brush edge materials. */
describe('SolidBrushEdgeMaterials', () => {
  it('reuses one front material instance per operation', () => {
    const first = SolidBrushEdgeMaterials.getFrontMaterial(SolidOperation.Additive, TEST_WIRE_COLOR);
    const second = SolidBrushEdgeMaterials.getFrontMaterial(SolidOperation.Additive, TEST_WIRE_COLOR);
    expect(first).toBe(second);
    expect(first.userData[BRUSH_EDGE_SHARED_MATERIAL_KEY]).toBe(true);
    expect(first.userData[BRUSH_EDGE_DISTANCE_FADE_KEY]).toBe(true);
  });

  it('configures depth-tested edge opacity and fade uniforms', () => {
    const front = SolidBrushEdgeMaterials.getFrontMaterial(SolidOperation.Subtractive, TEST_WIRE_COLOR);
    expect(front.depthFunc).toBe(THREE.LessEqualDepth);
    expect(front.uniforms['opacity']!.value).toBeCloseTo(BRUSH_EDGE_FRONT_OPACITY);
    expect(front.uniforms['fadeNear']!.value).toBe(BRUSH_EDGE_FADE_NEAR);
    expect(front.uniforms['fadeFar']!.value).toBe(BRUSH_EDGE_FADE_FAR);
  });

  it('disables distance fade on cloned materials for 2D views', () => {
    const shared = SolidBrushEdgeMaterials.getFrontMaterial(SolidOperation.Intersecting, TEST_WIRE_COLOR);
    const cloned = shared.clone();
    SolidBrushEdgeMaterials.disableDistanceFade(cloned);
    expect(cloned.uniforms['fadeNear']!.value).toBeGreaterThan(1e6);
    expect(cloned.uniforms['fadeFar']!.value).toBeGreaterThan(cloned.uniforms['fadeNear']!.value);
    expect(shared.uniforms['fadeNear']!.value).toBe(BRUSH_EDGE_FADE_NEAR);
  });

  it('prepares ortho clones without depth testing so all 2D views show edges', () => {
    const shared = SolidBrushEdgeMaterials.getFrontMaterial(SolidOperation.Additive, TEST_WIRE_COLOR);
    const cloned = shared.clone();
    SolidBrushEdgeMaterials.prepareForOrthoClone(cloned);
    expect(cloned.depthTest).toBe(false);
    expect(cloned.depthWrite).toBe(false);
    expect(cloned.depthFunc).toBe(THREE.AlwaysDepth);
    expect(cloned.uniforms['fadeNear']!.value).toBeGreaterThan(1e6);
    expect(shared.depthTest).toBe(true);
    expect(shared.uniforms['fadeNear']!.value).toBe(BRUSH_EDGE_FADE_NEAR);
  });

  it('returns distinct colors per CSG operation', () => {
    const additive = SolidBrushEdgeMaterials.edgeColorForOperation(SolidOperation.Additive);
    const subtractive = SolidBrushEdgeMaterials.edgeColorForOperation(SolidOperation.Subtractive);
    const intersecting = SolidBrushEdgeMaterials.edgeColorForOperation(SolidOperation.Intersecting);
    expect(additive).not.toBe(subtractive);
    expect(subtractive).not.toBe(intersecting);
  });

  it('skips distance fade for orthographic cameras in the shared edge shader', () => {
    const material = SolidBrushEdgeMaterials.getFrontMaterial(SolidOperation.Additive, TEST_WIRE_COLOR);
    expect(material.vertexShader).toContain('projectionMatrix[2][3]');
    expect(material.vertexShader).toContain('isPerspective');
    expect(material.vertexShader).toContain('vFade = 1.0');
  });

  it('toggles shared material depth testing for 2D multi-view passes', () => {
    const front = SolidBrushEdgeMaterials.getFrontMaterial(SolidOperation.Additive, TEST_WIRE_COLOR);
    SolidBrushEdgeMaterials.setDepthOcclusionEnabled(true);
    expect(SolidBrushEdgeMaterials.isDepthOcclusionEnabled()).toBe(true);
    expect(front.depthTest).toBe(true);
    expect(front.depthFunc).toBe(THREE.LessEqualDepth);
    SolidBrushEdgeMaterials.setDepthOcclusionEnabled(false);
    expect(SolidBrushEdgeMaterials.isDepthOcclusionEnabled()).toBe(false);
    expect(front.depthTest).toBe(false);
    expect(front.depthFunc).toBe(THREE.AlwaysDepth);
    SolidBrushEdgeMaterials.setDepthOcclusionEnabled(true);
    expect(front.depthTest).toBe(true);
    expect(front.depthFunc).toBe(THREE.LessEqualDepth);
  });

  it('shares one material per operation and 2D wire color, and splits different colors', () => {
    const otherWireColor = ViewportObjectWireColor.colorFromPaletteIndex(1);
    const first = SolidBrushEdgeMaterials.getFrontMaterial(SolidOperation.Additive, TEST_WIRE_COLOR);
    const other = SolidBrushEdgeMaterials.getFrontMaterial(SolidOperation.Additive, otherWireColor);
    expect(other).not.toBe(first);
    expect(first.userData[BRUSH_EDGE_ORTHO_COLOR_KEY]).toBe(TEST_WIRE_COLOR);
    expect(other.userData[BRUSH_EDGE_ORTHO_COLOR_KEY]).toBe(otherWireColor);
  });

  it('draws the operation color in 3D and the wire color in 2D', () => {
    const material = SolidBrushEdgeMaterials.getFrontMaterial(SolidOperation.Subtractive, TEST_WIRE_COLOR);
    expect(uniformColorHexRead(material, 'diffuse')).toBe(
      SolidBrushEdgeMaterials.edgeColorForOperation(SolidOperation.Subtractive),
    );
    expect(uniformColorHexRead(material, 'orthoDiffuse')).toBe(TEST_WIRE_COLOR);
    expect(material.fragmentShader).toContain('mix(orthoDiffuse, diffuse, vPerspective)');
  });

  it('overrides both projection colors for one pass and restores them afterwards', () => {
    const material = SolidBrushEdgeMaterials.getFrontMaterial(SolidOperation.Intersecting, TEST_WIRE_COLOR);
    SolidBrushEdgeMaterials.setDiffuseColorOverrideForRenderPass(Theme.selectionColor);
    expect(uniformColorHexRead(material, 'diffuse')).toBe(Theme.selectionColor);
    expect(uniformColorHexRead(material, 'orthoDiffuse')).toBe(Theme.selectionColor);
    SolidBrushEdgeMaterials.clearDiffuseColorOverrideForRenderPass();
    expect(uniformColorHexRead(material, 'diffuse')).toBe(
      SolidBrushEdgeMaterials.edgeColorForOperation(SolidOperation.Intersecting),
    );
    expect(uniformColorHexRead(material, 'orthoDiffuse')).toBe(TEST_WIRE_COLOR);
  });
});

/**
 * Reads a color uniform of a shader material as a hex number.
 *
 * @param material Shader material.
 * @param uniformName Name of the color uniform.
 * @returns Hex color, or -1 when the uniform is missing or not a color.
 */
function uniformColorHexRead(material: THREE.ShaderMaterial, uniformName: string): number {
  const value: unknown = material.uniforms[uniformName]?.value;
  return value instanceof THREE.Color ? value.getHex() : -1;
}
