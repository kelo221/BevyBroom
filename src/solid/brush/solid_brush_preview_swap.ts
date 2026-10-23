import * as THREE from 'three';
import { SolidBrush } from '@/solid/brush/solid_brush.js';
import { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import { SolidBrushVisual } from '@/solid/model/solid_brush_visual.js';

/**
 * Replaces a brush instance's topology and rebuilds its hull preview mesh in
 * place, keeping the pose, name, sibling order, and parent.
 *
 * @param instance Brush instance receiving the new geometry.
 * @param brush New local convex topology.
 */
export function solidBrushPreviewSwap(instance: SolidBrushInstance, brush: SolidBrush): void {
  instance.brush = brush;
  const previous = instance.mesh;
  if (!previous) {
    return;
  }
  const parent = previous.parent;
  const siblingIndex = parent ? parent.children.indexOf(previous) : 0;
  const replacement = SolidBrushVisual.createHullPreview(instance.name, brush, instance.operation);
  replacement.position.copy(previous.position);
  replacement.rotation.copy(previous.rotation);
  replacement.scale.copy(previous.scale);
  instance.attachMesh(replacement);
  if (parent) {
    parent.remove(previous);
    parent.add(replacement);
    solidBrushSiblingIndexRestore(parent, replacement, siblingIndex);
  }
  solidBrushMeshTreeDispose(previous);
}

/**
 * Moves a child to a specific sibling index under its parent.
 *
 * @param parent Parent object.
 * @param child Child to reorder.
 * @param index Desired sibling index.
 */
function solidBrushSiblingIndexRestore(parent: THREE.Object3D, child: THREE.Object3D, index: number): void {
  const current = parent.children.indexOf(child);
  if (current < 0 || current === index) {
    return;
  }
  parent.children.splice(current, 1);
  parent.children.splice(index, 0, child);
}

/**
 * Disposes geometry and materials of a mesh tree.
 *
 * @param root Root object.
 */
function solidBrushMeshTreeDispose(root: THREE.Object3D): void {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh) && !(child instanceof THREE.LineSegments)) {
      return;
    }
    child.geometry?.dispose();
    const material = child.material;
    if (Array.isArray(material)) {
      material.forEach((entry) => entry.dispose());
    } else if (material) {
      material.dispose();
    }
  });
}
