import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SolidBrushFactory } from '@/solid/brush/solid_brush_factory.js';
import { SolidBrushVisual, SOLID_BRUSH_OCCLUDED_EDGE_USERDATA_KEY } from '@/solid/model/solid_brush_visual.js';
import {
  SolidBrushEdgeMaterials,
  BRUSH_EDGE_FADE_NEAR,
  BRUSH_EDGE_FADE_FAR,
  SOLID_BRUSH_EDGE_USERDATA_KEY,
  BRUSH_EDGE_ORTHO_COLOR_KEY,
} from '@/solid/model/solid_brush_edge_materials.js';
import { SOLID_MODEL_USERDATA_KEY } from '@/solid/model/solid_model_keys.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';
import { rebuildDecorativeEdges, usesContentDecorativeEdges } from '@/utils/mesh_edge_sync.js';
import { ViewportObjectWireColor } from '@/viewports/shading/viewport_object_wire_color.js';
import { solidBrushWireOwnerIdRead } from '@/solid/model/solid_model_root_find.js';
import { Theme } from '@/theme.js';

/** Unit tests for solid brush preview visuals (outline-only vs selected fill). */
describe('SolidBrushVisual', () => {
  it('creates box previews that are outline-only by default', () => {
    const size = 1.5 + Math.random();
    const mesh = SolidBrushVisual.createBoxPreview('Brush', size, SolidOperation.Subtractive);
    expect(SolidBrushVisual.isBrushObject(mesh)).toBe(true);
    expect(SolidBrushVisual.isHullFillVisible(mesh)).toBe(false);
    const material = mesh.material as THREE.MeshBasicMaterial;
    expect(material).toBeInstanceOf(THREE.MeshBasicMaterial);
    expect(material.colorWrite).toBe(false);
    expect(material.visible).toBe(false);
    expect(material.transparent).toBe(false);
    expect(material.depthWrite).toBe(false);
    expect(material.side).toBe(THREE.FrontSide);
    disposeBrushPreview(mesh);
  });

  it('uses a single shared depth-tested distance-faded edge line', () => {
    const brush = SolidBrushFactory.createCenteredBox(2, 2, 2);
    const mesh = SolidBrushVisual.createHullPreview('Hull', brush, SolidOperation.Subtractive);
    const edges = collectDecorativeEdges(mesh);
    expect(edges).toHaveLength(1);
    const front = edges[0]!;
    expect(front.userData[SOLID_BRUSH_OCCLUDED_EDGE_USERDATA_KEY]).not.toBe(true);
    expect(front.material).toBe(expectedFrontMaterial(mesh, SolidOperation.Subtractive));
    const frontMaterial = front.material as THREE.ShaderMaterial;
    expect(frontMaterial.depthFunc).toBe(THREE.LessEqualDepth);
    expect(frontMaterial.depthTest).toBe(true);
    expect(frontMaterial.uniforms['fadeNear']!.value).toBe(BRUSH_EDGE_FADE_NEAR);
    expect(frontMaterial.uniforms['fadeFar']!.value).toBe(BRUSH_EDGE_FADE_FAR);
    disposeBrushPreview(mesh);
  });

  it('strips legacy occluded ghost edges when rebinding operation style', () => {
    const mesh = SolidBrushVisual.createBoxPreview('Legacy', 2, SolidOperation.Additive);
    const front = collectDecorativeEdges(mesh)[0]!;
    const ghost = new THREE.LineSegments(front.geometry, front.material);
    ghost.userData[SOLID_BRUSH_EDGE_USERDATA_KEY] = true;
    ghost.userData[SOLID_BRUSH_OCCLUDED_EDGE_USERDATA_KEY] = true;
    mesh.add(ghost);
    expect(collectDecorativeEdges(mesh)).toHaveLength(2);
    SolidBrushVisual.applyOperationStyle(mesh, SolidOperation.Subtractive);
    const edges = collectDecorativeEdges(mesh);
    expect(edges).toHaveLength(1);
    expect(edges[0]!.userData[SOLID_BRUSH_OCCLUDED_EDGE_USERDATA_KEY]).not.toBe(true);
    expect(edges[0]!.material).toBe(expectedFrontMaterial(mesh, SolidOperation.Subtractive));
    disposeBrushPreview(mesh);
  });

  it('shows translucent operation-tinted fill only when fill is enabled', () => {
    const mesh = SolidBrushVisual.createBoxPreview('Brush', 2, SolidOperation.Subtractive);
    SolidBrushVisual.setHullFillVisible(mesh, true);
    expect(SolidBrushVisual.isHullFillVisible(mesh)).toBe(true);
    const material = mesh.material as THREE.MeshBasicMaterial;
    expect(material.visible).toBe(true);
    expect(material.colorWrite).toBe(true);
    expect(material.transparent).toBe(true);
    expect(material.opacity).toBeCloseTo(0.22, 5);
    expect(material.color.getHex()).toBe(Theme.solidFillSubtractiveColor);
    expect(material.side).toBe(THREE.DoubleSide);
    expect(material.depthTest).toBe(true);
    expect(material.polygonOffset).toBe(true);
    expect(material.polygonOffsetFactor).toBeLessThan(0);
    expect(material.polygonOffsetUnits).toBeLessThan(0);
    SolidBrushVisual.setHullFillVisible(mesh, false);
    expect(material.visible).toBe(false);
    expect(material.colorWrite).toBe(false);
    expect(material.transparent).toBe(false);
    expect(material.depthWrite).toBe(false);
    disposeBrushPreview(mesh);
  });

  it('keeps double-sided selected fill with negative offset after perspective depth restore', () => {
    const root = new THREE.Group();
    const mesh = SolidBrushVisual.createBoxPreview('Brush', 2, SolidOperation.Subtractive);
    root.add(mesh);
    SolidBrushVisual.setHullFillVisible(mesh, true);
    SolidBrushVisual.setHullFillDepthOcclusionEnabled(root, false);
    SolidBrushVisual.setHullFillDepthOcclusionEnabled(root, true);
    const material = mesh.material as THREE.MeshBasicMaterial;
    expect(material.side).toBe(THREE.DoubleSide);
    expect(material.polygonOffset).toBe(true);
    expect(material.polygonOffsetFactor).toBeLessThan(0);
    expect(material.depthTest).toBe(true);
    disposeBrushPreview(mesh);
  });

  it('disables depth testing on selected hull fills for orthographic 2D clones', () => {
    const mesh = SolidBrushVisual.createBoxPreview('Brush', 2, SolidOperation.Additive);
    SolidBrushVisual.prepareBrushMeshForOrthoClone(mesh);
    SolidBrushVisual.setHullFillVisible(mesh, true);
    const material = mesh.material as THREE.MeshBasicMaterial;
    expect(SolidBrushVisual.isOrthoCloneBrush(mesh)).toBe(true);
    expect(material.depthTest).toBe(false);
    expect(material.depthWrite).toBe(false);
    expect(material.depthFunc).toBe(THREE.AlwaysDepth);
    expect(mesh.renderOrder).toBeGreaterThan(2);
    disposeBrushPreview(mesh);
  });

  it('toggles selected hull fill depth for shared orthographic multi-view passes', () => {
    const root = new THREE.Group();
    const mesh = SolidBrushVisual.createBoxPreview('Brush', 2, SolidOperation.Additive);
    root.add(mesh);
    SolidBrushVisual.setHullFillVisible(mesh, true);
    const material = mesh.material as THREE.MeshBasicMaterial;
    SolidBrushVisual.setHullFillDepthOcclusionEnabled(root, true);
    expect(material.depthTest).toBe(true);
    expect(material.depthFunc).toBe(THREE.LessEqualDepth);
    SolidBrushVisual.setHullFillDepthOcclusionEnabled(root, false);
    expect(SolidBrushVisual.isHullFillDepthOcclusionEnabled()).toBe(false);
    expect(material.depthTest).toBe(false);
    expect(material.depthFunc).toBe(THREE.AlwaysDepth);
    expect(mesh.renderOrder).toBeGreaterThan(2);
    const newlySelected = SolidBrushVisual.createBoxPreview('Later', 1, SolidOperation.Subtractive);
    root.add(newlySelected);
    SolidBrushVisual.setHullFillVisible(newlySelected, true);
    const laterMaterial = newlySelected.material as THREE.MeshBasicMaterial;
    expect(laterMaterial.depthTest).toBe(false);
    SolidBrushVisual.setHullFillDepthOcclusionEnabled(root, true);
    expect(material.depthTest).toBe(true);
    expect(laterMaterial.depthTest).toBe(true);
    disposeBrushPreview(mesh);
    disposeBrushPreview(newlySelected);
  });

  it('does not re-touch selected hull materials when depth occlusion mode is unchanged', () => {
    const root = new THREE.Group();
    const mesh = SolidBrushVisual.createBoxPreview('Brush', 2, SolidOperation.Additive);
    root.add(mesh);
    SolidBrushVisual.setHullFillVisible(mesh, true);
    SolidBrushVisual.setHullFillDepthOcclusionEnabled(root, false);
    const material = mesh.material as THREE.MeshBasicMaterial;
    const versionAfterSwitch = material.version;
    SolidBrushVisual.setHullFillDepthOcclusionEnabled(root, false);
    expect(material.version).toBe(versionAfterSwitch);
    disposeBrushPreview(mesh);
    SolidBrushVisual.setHullFillDepthOcclusionEnabled(root, true);
  });

  it('rebinds shared edge materials when the brush operation changes', () => {
    const mesh = SolidBrushVisual.createBoxPreview('Brush', 2, SolidOperation.Additive);
    SolidBrushVisual.setHullFillVisible(mesh, true);
    SolidBrushVisual.applyOperationStyle(mesh, SolidOperation.Intersecting);
    expect(SolidBrushVisual.isHullFillVisible(mesh)).toBe(true);
    const material = mesh.material as THREE.MeshBasicMaterial;
    expect(material.colorWrite).toBe(true);
    expect(material.color.getHex()).toBe(Theme.solidFillIntersectingColor);
    const edges = collectDecorativeEdges(mesh);
    expect(edges).toHaveLength(1);
    expect(edges[0]!.material).toBe(expectedFrontMaterial(mesh, SolidOperation.Intersecting));
    disposeBrushPreview(mesh);
  });

  it('creates additive edge materials for additive box previews', () => {
    const mesh = SolidBrushVisual.createBoxPreview('Add', 1, SolidOperation.Additive);
    const edges = collectDecorativeEdges(mesh);
    expect(edges).toHaveLength(1);
    expect(edges[0]!.material).toBe(expectedFrontMaterial(mesh, SolidOperation.Additive));
    disposeBrushPreview(mesh);
  });

  it('draws every brush of one solid model in the model wire color and selected brushes in red', () => {
    const root = new THREE.Group();
    root.userData[SOLID_MODEL_USERDATA_KEY] = true;
    const first = SolidBrushVisual.createBoxPreview('First', 1, SolidOperation.Additive);
    const second = SolidBrushVisual.createBoxPreview('Second', 1, SolidOperation.Subtractive);
    root.add(first, second);
    SolidBrushVisual.applyOperationStyle(first, SolidOperation.Additive);
    SolidBrushVisual.applyOperationStyle(second, SolidOperation.Subtractive);
    const modelWireColor = ViewportObjectWireColor.colorFromId(root.uuid);
    expect(edgeOrthoColorRead(first)).toBe(modelWireColor);
    expect(edgeOrthoColorRead(second)).toBe(modelWireColor);
    SolidBrushVisual.setHullFillVisible(second, true);
    expect(edgeOrthoColorRead(second)).toBe(Theme.selectionColor);
    expect(edgeOrthoColorRead(first)).toBe(modelWireColor);
    disposeBrushPreview(first);
    disposeBrushPreview(second);
  });

  it('never accepts white content decorative edges on brush previews', () => {
    const mesh = SolidBrushVisual.createBoxPreview('NoWhite', 2, SolidOperation.Additive);
    expect(usesContentDecorativeEdges(mesh)).toBe(false);
    const brushEdgeCount = collectDecorativeEdges(mesh).length;
    rebuildDecorativeEdges(mesh);
    expect(collectDecorativeEdges(mesh).length).toBe(brushEdgeCount);
    const whiteEdges = mesh.children.filter(
      (child) => child instanceof THREE.LineSegments && child.userData['isDecorativeEdge'] === true,
    );
    expect(whiteEdges).toHaveLength(0);
    disposeBrushPreview(mesh);
  });
});

/**
 * Collects decorative edge LineSegments under a brush preview.
 *
 * @param mesh Brush preview mesh.
 * @returns Decorative edge children.
 */
function collectDecorativeEdges(mesh: THREE.Mesh): THREE.LineSegments[] {
  return mesh.children.filter(
    (child): child is THREE.LineSegments =>
      child instanceof THREE.LineSegments && child.userData[SOLID_BRUSH_EDGE_USERDATA_KEY] === true,
  );
}

/**
 * Returns the shared edge material a brush preview should use: the operation
 * tint in 3D and the brush's stable (or selected) wire color in 2D.
 *
 * @param mesh Brush preview mesh.
 * @param operation Brush CSG operation.
 * @returns Expected shared edge material.
 */
function expectedFrontMaterial(mesh: THREE.Mesh, operation: SolidOperation): THREE.ShaderMaterial {
  const wireColor = ViewportObjectWireColor.colorResolve(
    solidBrushWireOwnerIdRead(mesh),
    SolidBrushVisual.isHullFillVisible(mesh),
  );
  return SolidBrushEdgeMaterials.getFrontMaterial(operation, wireColor);
}

/**
 * Reads the 2D wire color of the shared edge material of a brush preview.
 *
 * @param mesh Brush preview mesh.
 * @returns Wire color hex, or -1 when the brush has no shared edge material.
 */
function edgeOrthoColorRead(mesh: THREE.Mesh): number {
  const edge = collectDecorativeEdges(mesh)[0];
  const material = edge?.material;
  if (!(material instanceof THREE.ShaderMaterial)) return -1;
  const color: unknown = material.userData[BRUSH_EDGE_ORTHO_COLOR_KEY];
  return typeof color === 'number' ? color : -1;
}

/**
 * Disposes geometry and owned materials for a brush preview mesh.
 *
 * @param mesh Brush preview created by SolidBrushVisual.
 */
function disposeBrushPreview(mesh: THREE.Mesh): void {
  mesh.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
      child.geometry?.dispose();
      const material = child.material;
      if (Array.isArray(material)) {
        material.forEach((entry) => {
          if (!SolidBrushEdgeMaterials.isSharedMaterial(entry)) entry.dispose();
        });
      } else if (material && !SolidBrushEdgeMaterials.isSharedMaterial(material)) {
        material.dispose();
      }
    }
  });
}
