import * as THREE from 'three';
import type { ComponentSelectionEntry } from '@/edit/component/component_selection_entry.js';
import type { EditDomainTarget } from '@/edit/session/edit_session_domain.js';
import { expandComponentSelectionToTransformVertices } from '@/edit/transform/component_transform_selection.js';
import { componentTransformLocalToWorld } from '@/edit/transform/component_transform_vertex.js';

/** Shortest summed normal that still counts as one shared direction. */
const COMPONENT_DRAG_FACE_NORMAL_MINIMUM_LENGTH = 1e-6;

/**
 * Returns the shared world normal of a face-only component selection: the
 * normalized sum of every selected face normal.
 *
 * @param selected Component selection entries.
 * @param domain Edit Mode domain.
 * @returns Unit world normal, or null when the selection holds no faces, holds
 *   other components, or its faces cancel out.
 */
export function componentDragFaceNormalWorld(
  selected: readonly ComponentSelectionEntry[],
  domain: readonly EditDomainTarget[],
): THREE.Vector3 | null {
  if (selected.length === 0 || selected.some((entry) => entry.kind !== 'face')) {
    return null;
  }
  const sum = new THREE.Vector3();
  for (const entry of selected) {
    sum.add(componentDragFaceEntryNormalWorld(entry, domain));
  }
  return sum.length() < COMPONENT_DRAG_FACE_NORMAL_MINIMUM_LENGTH ? null : sum.normalize();
}

/**
 * Returns the unit world normal of one selected face from its ordered corners.
 *
 * @param entry Face selection entry.
 * @param domain Edit Mode domain.
 * @returns Unit normal, or a zero vector for a degenerate face.
 */
function componentDragFaceEntryNormalWorld(
  entry: ComponentSelectionEntry,
  domain: readonly EditDomainTarget[],
): THREE.Vector3 {
  const corners = expandComponentSelectionToTransformVertices([entry], domain).map((vertex) =>
    componentTransformLocalToWorld(vertex, vertex.initialLocal),
  );
  return componentDragPolygonNormal(corners);
}

/**
 * Computes the Newell normal of an ordered polygon.
 *
 * @param corners Ordered polygon corners.
 * @returns Unit normal, or a zero vector for a degenerate polygon.
 */
export function componentDragPolygonNormal(corners: readonly THREE.Vector3[]): THREE.Vector3 {
  const normal = new THREE.Vector3();
  for (let index = 0; index < corners.length; index += 1) {
    const current = corners[index];
    const next = corners[(index + 1) % corners.length];
    if (!current || !next) {
      continue;
    }
    normal.x += (current.y - next.y) * (current.z + next.z);
    normal.y += (current.z - next.z) * (current.x + next.x);
    normal.z += (current.x - next.x) * (current.y + next.y);
  }
  return normal.lengthSq() > 0 ? normal.normalize() : normal;
}
