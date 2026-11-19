import * as THREE from 'three';
import type { BrushEditCage } from '@/edit/brush/brush_edit_cage.js';
import { EditorComponentMode } from '@/types/editor_component_mode.js';
import { buildComponentEdgeKey, type ComponentSelectionEntry } from './component_selection_entry.js';
import {
  EDIT_CAGE_COLOR,
  EDIT_SELECTED_VERTEX_COLOR,
  type ComponentCageMeshSource,
} from './component_edit_selection_draw.js';
import {
  collectMeshEdges,
  collectMeshFaceVertexIndices,
  collectMeshWorldVertices,
} from './component_edit_cage_mesh_index.js';

/** Packed handle points: one per edge midpoint or face center. */
export interface ComponentHandleDrawBuffers {
  /** Flat xyz world positions. */
  coords: number[];
  /** Flat rgb 0–1 colors, selected handles highlighted. */
  colors: number[];
}

/** Edges and faces of one target as world corners and index lists. */
interface ComponentHandleTarget {
  targetId: string;
  worldPositions: readonly THREE.Vector3[];
  edges: ReadonlyArray<{ a: number; b: number }>;
  faces: ReadonlyArray<{ faceIndex: number; vertexIndices: readonly number[] }>;
}

/**
 * Builds the grab handles of the active component mode: a point at the middle
 * of every edge in Edge mode and at the center of every face in Face mode.
 * Vertex mode has none, since its vertex dots are the handles.
 *
 * @param meshSources Content mesh sources.
 * @param brushCages Brush cages.
 * @param selected Selected components.
 * @param mode Active component mode.
 * @returns Handle positions and colors.
 */
export function buildComponentHandleDrawBuffers(
  meshSources: readonly ComponentCageMeshSource[],
  brushCages: readonly BrushEditCage[],
  selected: readonly ComponentSelectionEntry[],
  mode: EditorComponentMode,
): ComponentHandleDrawBuffers {
  const buffers: ComponentHandleDrawBuffers = { coords: [], colors: [] };
  if (mode === EditorComponentMode.VERTEX) {
    return buffers;
  }
  const selectedKeys = new Set(selected.filter((entry) => entry.kind === mode).map(componentHandleKey));
  const targets = [...brushCages.map(componentHandleBrushTarget), ...meshSources.map(componentHandleMeshTarget)];
  for (const target of targets) {
    if (mode === EditorComponentMode.EDGE) {
      componentHandleEdgesAppend(target, selectedKeys, buffers);
    } else {
      componentHandleFacesAppend(target, selectedKeys, buffers);
    }
  }
  return buffers;
}

/**
 * Appends one handle at the middle of every edge.
 *
 * @param target Handle target.
 * @param selectedKeys Keys of selected components.
 * @param buffers Output buffers.
 */
function componentHandleEdgesAppend(
  target: ComponentHandleTarget,
  selectedKeys: ReadonlySet<string>,
  buffers: ComponentHandleDrawBuffers,
): void {
  for (const edge of target.edges) {
    const start = target.worldPositions[edge.a];
    const end = target.worldPositions[edge.b];
    if (!start || !end) {
      continue;
    }
    const key = `${target.targetId}|${buildComponentEdgeKey(edge.a, edge.b)}`;
    componentHandlePush(buffers, start.clone().add(end).multiplyScalar(0.5), selectedKeys.has(key));
  }
}

/**
 * Appends one handle at the center of every face.
 *
 * @param target Handle target.
 * @param selectedKeys Keys of selected components.
 * @param buffers Output buffers.
 */
function componentHandleFacesAppend(
  target: ComponentHandleTarget,
  selectedKeys: ReadonlySet<string>,
  buffers: ComponentHandleDrawBuffers,
): void {
  for (const face of target.faces) {
    const corners = face.vertexIndices.map((index) => target.worldPositions[index]).filter((corner) => !!corner);
    if (corners.length === 0) {
      continue;
    }
    const center = new THREE.Vector3();
    corners.forEach((corner) => center.add(corner as THREE.Vector3));
    center.multiplyScalar(1 / corners.length);
    componentHandlePush(buffers, center, selectedKeys.has(`${target.targetId}|${face.faceIndex}`));
  }
}

/**
 * Appends one handle point.
 *
 * @param buffers Output buffers.
 * @param point World position.
 * @param selected Whether the handle's component is selected.
 */
function componentHandlePush(buffers: ComponentHandleDrawBuffers, point: THREE.Vector3, selected: boolean): void {
  const color = new THREE.Color(selected ? EDIT_SELECTED_VERTEX_COLOR : EDIT_CAGE_COLOR);
  buffers.coords.push(point.x, point.y, point.z);
  buffers.colors.push(color.r, color.g, color.b);
}

/**
 * Builds the lookup key of a selection entry.
 *
 * @param entry Selection entry.
 * @returns Key joining target and component.
 */
function componentHandleKey(entry: ComponentSelectionEntry): string {
  return `${entry.targetId}|${entry.componentKey}`;
}

/**
 * Reads the edges and faces of a brush cage.
 *
 * @param cage Brush cage.
 * @returns Handle target.
 */
function componentHandleBrushTarget(cage: BrushEditCage): ComponentHandleTarget {
  return {
    targetId: cage.targetId,
    worldPositions: cage.worldPositions,
    edges: cage.edges.map((edge) => ({ a: edge.vertexA, b: edge.vertexB })),
    faces: cage.faces,
  };
}

/**
 * Reads the edges and faces of a content mesh.
 *
 * @param source Content mesh source.
 * @returns Handle target.
 */
function componentHandleMeshTarget(source: ComponentCageMeshSource): ComponentHandleTarget {
  source.mesh.updateMatrixWorld(true);
  const faceCount = source.document.getTopology().getFaceCount();
  const allFaces = new Set(Array.from({ length: faceCount }, (_unused, index) => index));
  const faceMap = collectMeshFaceVertexIndices(source.document, allFaces);
  return {
    targetId: source.targetId,
    worldPositions: collectMeshWorldVertices(source),
    edges: collectMeshEdges(source.document),
    faces: Array.from(faceMap.entries(), ([faceIndex, vertexIndices]) => ({ faceIndex, vertexIndices })),
  };
}
