import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FaceSelectionHighlight } from '@/selection/face/face_selection_highlight.js';
import { findFirstTriangleForBrushSurface } from '@/selection/face/solid_triangle_source_index.js';
import type { FaceSelection } from '@/selection/face/manager_face_selection.js';
import { CommandDisplacementEdit } from '@/displacement/commands/command_displacement_edit.js';
import { displacementSurfaceCreate } from '@/displacement/model/displacement_face_surface.js';
import { DisplacementSculptStroke } from '@/displacement/sculpt/displacement_sculpt_stroke.js';
import type { SolidFaceTextureTarget } from '@/texture/commands/command_texture_solid_face_edit.js';
import {
  displacementTestBoxAdd,
  displacementTestCreate,
  displacementTestFaceCenter,
  displacementTestFaceFacing,
  displacementTestRigCreate,
  displacementTestStrokeSettings,
  displacementTestSurfaceMeshFind,
  displacementTestTarget,
  type DisplacementTestRig,
} from '../../displacement/displacement_test_rig.js';

/**
 * Returns the geometry of the front-pass highlight mesh in a scene.
 *
 * @param scene Scene holding the highlight.
 * @returns Front-pass highlight geometry.
 */
function highlightFrontGeometryRead(scene: THREE.Scene): THREE.BufferGeometry {
  let found: THREE.BufferGeometry | null = null;
  scene.traverse((child) => {
    const isFront = child.userData['isFaceSelectionHighlight'] && !child.userData['isFaceSelectionHighlightOccluded'];
    if (child instanceof THREE.Mesh && isFront) {
      found = child.geometry as THREE.BufferGeometry;
    }
  });
  if (!found) throw new Error('highlight mesh missing');
  return found;
}

/**
 * Sums the triangle areas of a non-indexed geometry.
 *
 * @param geometry Non-indexed triangle geometry.
 * @returns Total area.
 */
function geometryAreaSum(geometry: THREE.BufferGeometry): number {
  const position = geometry.getAttribute('position');
  const triangle = new THREE.Triangle();
  let area = 0;
  for (let vertex = 0; vertex + 2 < position.count; vertex += 3) {
    triangle.setFromAttributeAndIndices(position, vertex, vertex + 1, vertex + 2);
    area += triangle.getArea();
  }
  return area;
}

/** Face selection highlight on displaced brush faces. */
describe('FaceSelectionHighlight displaced faces', () => {
  it('overlays the displacement surface and follows it after the surface changes', () => {
    const rig = displacementTestRigCreate('HighlightDisplaced');
    const edges = new THREE.Vector3(2, 2, 3);
    const brush = displacementTestBoxAdd(rig, edges, new THREE.Vector3(0, 4, 0));
    const target = displacementTestTarget(rig, brush, displacementTestFaceFacing(brush, new THREE.Vector3(0, 1, 0)));
    displacementTestCreate(rig, target, 2);
    const resultMesh = rig.model.getResultMesh();
    const faceIndex = findFirstTriangleForBrushSurface(resultMesh, target.brushId, target.surfaceIndex);
    const selection: FaceSelection[] = [{ mesh: resultMesh, faceIndex }];
    const scene = new THREE.Scene();
    const highlight = new FaceSelectionHighlight(scene);
    highlight.setSelectedFaces(selection);
    highlight.flushPendingHighlights();
    const flatGeometry = highlightFrontGeometryRead(scene);
    expect(geometryAreaSum(flatGeometry)).toBeCloseTo(edges.x * edges.z, 4);
    const flatTop = new THREE.Box3().setFromBufferAttribute(
      flatGeometry.getAttribute('position') as THREE.BufferAttribute,
    );
    const elevation = 0.5;
    rig.commandStack.push(
      new CommandDisplacementEdit([{ target, displacement: displacementSurfaceCreate(2, elevation) }]),
    );
    highlight.setSelectedFaces([{ mesh: rig.model.getResultMesh(), faceIndex }]);
    highlight.flushPendingHighlights();
    const raisedGeometry = highlightFrontGeometryRead(scene);
    const raisedTop = new THREE.Box3().setFromBufferAttribute(
      raisedGeometry.getAttribute('position') as THREE.BufferAttribute,
    );
    expect(raisedTop.max.y - flatTop.max.y).toBeCloseTo(elevation, 4);
    highlight.dispose();
  });

  it('follows the displacement surface through undo and redo of a sculpt stroke without reselecting', () => {
    const parts = highlightTestSelectedDisplacedFaceCreate();
    const flatPositions = highlightTestSurfaceWorldPositions(parts);
    highlightTestRaiseStroke(parts);
    const sculptedPositions = highlightTestSurfaceWorldPositions(parts);
    expect(highlightTestLargestDifference(sculptedPositions, flatPositions)).toBeGreaterThan(1e-3);
    expect(highlightTestLargestDifference(highlightTestPositionsFlush(parts), sculptedPositions)).toBeLessThan(1e-5);
    parts.rig.commandStack.undo();
    const undonePositions = highlightTestPositionsFlush(parts);
    const restoredSurface = highlightTestSurfaceWorldPositions(parts);
    expect(highlightTestLargestDifference(undonePositions, restoredSurface)).toBeLessThan(1e-5);
    expect(highlightTestLargestDifference(undonePositions, sculptedPositions)).toBeGreaterThan(1e-3);
    parts.rig.commandStack.redo();
    expect(highlightTestLargestDifference(highlightTestPositionsFlush(parts), sculptedPositions)).toBeLessThan(1e-5);
    parts.highlight.dispose();
  });
});

/** Rig, selected displaced face and the highlight showing it. */
interface HighlightTestParts {
  rig: DisplacementTestRig;
  target: SolidFaceTextureTarget;
  scene: THREE.Scene;
  highlight: FaceSelectionHighlight;
  edges: THREE.Vector3;
}

/**
 * Builds a box whose top face is displaced and selected in a face highlight.
 *
 * @returns Test parts with the highlight already applied.
 */
function highlightTestSelectedDisplacedFaceCreate(): HighlightTestParts {
  const rig = displacementTestRigCreate('HighlightDisplacedUndo');
  const edges = new THREE.Vector3(3, 1, 3);
  const brush = displacementTestBoxAdd(rig, edges, new THREE.Vector3(-2, 1, 4));
  const target = displacementTestTarget(rig, brush, displacementTestFaceFacing(brush, new THREE.Vector3(0, 1, 0)));
  displacementTestCreate(rig, target, 3);
  const resultMesh = rig.model.getResultMesh();
  const faceIndex = findFirstTriangleForBrushSurface(resultMesh, target.brushId, target.surfaceIndex);
  const scene = new THREE.Scene();
  const highlight = new FaceSelectionHighlight(scene);
  highlight.setSelectedFaces([{ mesh: resultMesh, faceIndex }]);
  highlight.flushPendingHighlights();
  return { rig, target, scene, highlight, edges };
}

/**
 * Paints one raising Paint Geometry stroke at the center of the displaced face.
 *
 * @param parts Test parts whose undo stack receives the stroke.
 */
function highlightTestRaiseStroke(parts: HighlightTestParts): void {
  const radius = parts.edges.x / 2;
  const stroke = new DisplacementSculptStroke(
    parts.rig.commandStack,
    [parts.target],
    displacementTestStrokeSettings({ effect: 'raise_lower', radius, distance: radius / 2, direction: 1 }),
  );
  stroke.dabApply(displacementTestFaceCenter(parts.target));
  stroke.finish();
}

/**
 * Lists the world triangle corners of the face's current displacement surface
 * mesh, three per triangle in index order, as flat coordinates.
 *
 * @param parts Test parts.
 * @returns World corner coordinates.
 */
function highlightTestSurfaceWorldPositions(parts: HighlightTestParts): number[] {
  const surfaceMesh = displacementTestSurfaceMeshFind(parts.rig, parts.target);
  if (!surfaceMesh) throw new Error('target face has no surface mesh');
  surfaceMesh.updateWorldMatrix(true, false);
  const triangles = surfaceMesh.geometry.index ? surfaceMesh.geometry.toNonIndexed() : surfaceMesh.geometry;
  const position = triangles.getAttribute('position');
  const corner = new THREE.Vector3();
  return Array.from({ length: position.count }, (_unused, vertex) =>
    corner.fromBufferAttribute(position, vertex).applyMatrix4(surfaceMesh.matrixWorld).toArray(),
  ).flat();
}

/**
 * Applies any highlight update the surface change scheduled, without passing a
 * new selection, and reads the front-pass highlight corner coordinates.
 *
 * @param parts Test parts.
 * @returns Flat corner coordinates.
 */
function highlightTestPositionsFlush(parts: HighlightTestParts): number[] {
  parts.highlight.flushPendingHighlights();
  return Array.from(highlightFrontGeometryRead(parts.scene).getAttribute('position').array);
}

/**
 * Returns the largest coordinate difference of two equally long coordinate
 * lists, or infinity when their lengths differ.
 *
 * @param first First coordinate list.
 * @param second Second coordinate list.
 * @returns Largest absolute difference.
 */
function highlightTestLargestDifference(first: readonly number[], second: readonly number[]): number {
  if (first.length !== second.length) {
    return Number.POSITIVE_INFINITY;
  }
  return first.reduce((largest, value, index) => Math.max(largest, Math.abs(value - (second[index] ?? 0))), 0);
}
