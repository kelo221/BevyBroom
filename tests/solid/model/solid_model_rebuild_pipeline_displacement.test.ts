import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SOLID_TRIANGLE_SOURCES_USERDATA_KEY } from '@/solid/model/solid_model_keys.js';
import type { SolidTriangleSourceRef } from '@/selection/face/solid_result_face_indices.js';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import { CommandDisplacementEdit } from '@/displacement/commands/command_displacement_edit.js';
import {
  displacementTestBoxAdd,
  displacementTestCreate,
  displacementTestFaceFacing,
  displacementTestRigCreate,
  displacementTestSurfaceMeshFind,
  displacementTestTarget,
  type DisplacementTestRig,
} from '../../displacement/displacement_test_rig.js';

/** Visible and total result triangle counts of one brush. */
interface RenderTestBrushTriangles {
  /** Result triangles of the brush with non-zero area. */
  visible: number;
  /** Every result triangle of the brush, collapsed or not. */
  total: number;
}

/**
 * Counts the result triangles of one brush, separating those drawn with area.
 *
 * @param rig Test rig.
 * @param brush Brush whose triangles are counted.
 * @returns Visible and total triangle counts.
 */
function renderTestBrushTrianglesRead(rig: DisplacementTestRig, brush: SolidBrushInstance): RenderTestBrushTriangles {
  const resultMesh = rig.model.getResultMesh();
  const sources = resultMesh.userData[SOLID_TRIANGLE_SOURCES_USERDATA_KEY] as SolidTriangleSourceRef[];
  const position = resultMesh.geometry.getAttribute('position') as THREE.BufferAttribute;
  const triangle = new THREE.Triangle();
  const counts: RenderTestBrushTriangles = { visible: 0, total: 0 };
  sources.forEach((source, triangleIndex) => {
    if (source.brushId !== brush.id) return;
    counts.total += 1;
    triangle.setFromAttributeAndIndices(position, triangleIndex * 3, triangleIndex * 3 + 1, triangleIndex * 3 + 2);
    counts.visible += triangle.getArea() > 1e-9 ? 1 : 0;
  });
  return counts;
}

/** Viewport result rendering of brushes that carry a displacement. */
describe('SolidModelRebuildPipeline displaced brushes', () => {
  it('hides every face of a displaced brush, keeps its neighbour and restores it after undo and Destroy', () => {
    const rig = displacementTestRigCreate('RenderDisplaced');
    const edges = new THREE.Vector3(2, 1, 3);
    const displacedBrush = displacementTestBoxAdd(rig, edges, new THREE.Vector3(0, 0, 0));
    const neighbourBrush = displacementTestBoxAdd(rig, edges, new THREE.Vector3(edges.x * 3, 0, 0));
    const flatDisplaced = renderTestBrushTrianglesRead(rig, displacedBrush);
    const flatNeighbour = renderTestBrushTrianglesRead(rig, neighbourBrush);
    expect(flatDisplaced.visible).toBe(flatDisplaced.total);
    expect(flatDisplaced.total).toBeGreaterThan(0);
    const upward = displacementTestFaceFacing(displacedBrush, new THREE.Vector3(0, 1, 0));
    const target = displacementTestTarget(rig, displacedBrush, upward);
    displacementTestCreate(rig, target, 2);
    expect(renderTestBrushTrianglesRead(rig, displacedBrush)).toEqual({ visible: 0, total: flatDisplaced.total });
    expect(renderTestBrushTrianglesRead(rig, neighbourBrush)).toEqual(flatNeighbour);
    expect(displacementTestSurfaceMeshFind(rig, target)).toBeDefined();
    expect(rig.commandStack.undo()).toBe(true);
    expect(renderTestBrushTrianglesRead(rig, displacedBrush)).toEqual(flatDisplaced);
    expect(rig.commandStack.redo()).toBe(true);
    expect(renderTestBrushTrianglesRead(rig, displacedBrush).visible).toBe(0);
    rig.commandStack.push(new CommandDisplacementEdit([{ target, displacement: null }]));
    expect(renderTestBrushTrianglesRead(rig, displacedBrush)).toEqual(flatDisplaced);
    expect(displacementTestSurfaceMeshFind(rig, target)).toBeUndefined();
  });
});
