import type * as THREE from 'three';
import { buildComponentEdgeKey, type ComponentSelectionEntry } from '@/edit/component/component_selection_entry.js';
import type { TopologyWorkingGeometry } from './topology_working_geometry.js';

/**
 * Largest distance at which a corner after a topology change is the same corner
 * as before.
 */
const TOPOLOGY_SELECTION_REMAP_EPSILON = 1e-4;

/**
 * One selected component and the corner positions it covered before a topology
 * change.
 */
export interface TopologySelectionCorners {
  /** Selection entry before the change. */
  readonly entry: ComponentSelectionEntry;
  /** Local corner positions of the component. */
  readonly corners: readonly THREE.Vector3[];
}

/**
 * Records the corner positions of every selected component, so the selection
 * can be found again after the topology is rebuilt.
 *
 * @param selected Selection entries.
 * @param geometryByTarget Working geometry of each target before the change.
 * @returns Corner positions per entry; entries of unknown targets are left out.
 */
export function topologySelectionCornersCapture(
  selected: readonly ComponentSelectionEntry[],
  geometryByTarget: ReadonlyMap<string, TopologyWorkingGeometry>,
): TopologySelectionCorners[] {
  const captured: TopologySelectionCorners[] = [];
  for (const entry of selected) {
    const geometry = geometryByTarget.get(entry.targetId);
    if (geometry) {
      const corners = topologySelectionEntryIndices(entry, geometry).map((index) => geometry.positions[index]);
      captured.push({
        entry,
        corners: corners.filter((corner) => !!corner).map((corner) => (corner as THREE.Vector3).clone()),
      });
    }
  }
  return captured;
}

/**
 * Finds the captured components again in rebuilt geometry: vertices and edges
 * by their corner positions, and every face whose corners all belonged to a
 * selected face (a split face selects all its parts).
 *
 * @param captured Corner positions per entry.
 * @param geometryByTarget Working geometry of each target after the change.
 * @returns Selection entries in the rebuilt geometry, without duplicates.
 */
export function topologySelectionRemap(
  captured: readonly TopologySelectionCorners[],
  geometryByTarget: ReadonlyMap<string, TopologyWorkingGeometry>,
): ComponentSelectionEntry[] {
  const remapped = new Map<string, ComponentSelectionEntry>();
  for (const item of captured) {
    const geometry = geometryByTarget.get(item.entry.targetId);
    if (!geometry) {
      continue;
    }
    for (const componentKey of topologySelectionKeysFind(item, geometry)) {
      const entry = { targetId: item.entry.targetId, kind: item.entry.kind, componentKey };
      remapped.set(`${entry.targetId}|${entry.kind}|${componentKey}`, entry);
    }
  }
  return Array.from(remapped.values());
}

/**
 * Finds the component keys one captured entry maps to.
 *
 * @param item Captured entry.
 * @param geometry Rebuilt geometry.
 * @returns Component keys, empty when the component is gone.
 */
function topologySelectionKeysFind(item: TopologySelectionCorners, geometry: TopologyWorkingGeometry): string[] {
  const indices = item.corners.map((corner) => topologySelectionCornerIndexFind(corner, geometry));
  if (indices.some((index) => index < 0)) {
    return [];
  }
  if (item.entry.kind === 'vertex') {
    return [String(indices[0])];
  }
  if (item.entry.kind === 'edge') {
    const [first, second] = indices;
    return first === undefined || second === undefined || first === second
      ? []
      : [buildComponentEdgeKey(first, second)];
  }
  const cornerSet = new Set(indices);
  return geometry.faces
    .map((face, faceIndex) => ({ face, faceIndex }))
    .filter(({ face }) => face.vertexIndices.length >= 3 && face.vertexIndices.every((index) => cornerSet.has(index)))
    .map(({ faceIndex }) => String(faceIndex));
}

/**
 * Finds the index of the corner at a position.
 *
 * @param corner Local position.
 * @param geometry Geometry to search.
 * @returns Corner index, or -1 when no corner sits there.
 */
function topologySelectionCornerIndexFind(corner: THREE.Vector3, geometry: TopologyWorkingGeometry): number {
  return geometry.positions.findIndex((position) => position.distanceTo(corner) <= TOPOLOGY_SELECTION_REMAP_EPSILON);
}

/**
 * Lists the corner indices a selection entry covers.
 *
 * @param entry Selection entry.
 * @param geometry Geometry the entry indexes into.
 * @returns Corner indices.
 */
function topologySelectionEntryIndices(entry: ComponentSelectionEntry, geometry: TopologyWorkingGeometry): number[] {
  if (entry.kind === 'vertex') {
    return [Number(entry.componentKey)];
  }
  if (entry.kind === 'edge') {
    return entry.componentKey.split(':').map(Number);
  }
  return geometry.faces[Number(entry.componentKey)]?.vertexIndices.slice() ?? [];
}
