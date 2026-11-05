import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FaceSelectionHighlight } from '@/selection/face/face_selection_highlight.js';
import { findFirstTriangleForBrushSurface } from '@/selection/face/solid_triangle_source_index.js';
import type { FaceSelection } from '@/selection/face/manager_face_selection.js';
import { CommandDisplacementEdit } from '@/displacement/commands/command_displacement_edit.js';
import { displacementSurfaceCreate } from '@/displacement/model/displacement_face_surface.js';
import {
  displacementTestBoxAdd,
  displacementTestCreate,
  displacementTestFaceFacing,
  displacementTestRigCreate,
  displacementTestTarget,
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
});
