import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { DISPLACEMENT_POWERS } from '@/displacement/model/displacement_types.js';
import {
  displacementRowLength,
  displacementSurfaceClone,
  displacementSurfaceCreate,
  displacementVertexCount,
} from '@/displacement/model/displacement_face_surface.js';
import { CommandDisplacementEdit } from '@/displacement/commands/command_displacement_edit.js';
import { DisplacementSculptFace } from '@/displacement/sculpt/displacement_sculpt_face.js';
import { DisplacementSculptOps } from '@/displacement/sculpt/displacement_sculpt_ops.js';
import { DisplacementSculptStroke } from '@/displacement/sculpt/displacement_sculpt_stroke.js';
import { DisplacementSew } from '@/displacement/sculpt/displacement_sew.js';
import type { SolidFaceTextureTarget } from '@/texture/commands/command_texture_solid_face_edit.js';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import {
  displacementTestBoxAdd,
  displacementTestCreate,
  displacementTestFaceCenter,
  displacementTestFaceFacing,
  displacementTestOffsetsRead,
  displacementTestRigCreate,
  displacementTestSharedEdgeExpectSewn,
  displacementTestStore,
  displacementTestStrokeSettings,
  displacementTestSurfaceMeshFind,
  displacementTestTarget,
  displacementTestWorldPositions,
  type DisplacementTestRig,
} from '../displacement_test_rig.js';

/** Edge lengths of the test boxes. */
const SCULPT_TEST_BOX_EDGES = new THREE.Vector3(4, 2, 4);

/** World center of the single test box. */
const SCULPT_TEST_BOX_CENTER = new THREE.Vector3(1, 3, -2);

/**
 * Builds a rig with one box and returns its upward face as a target.
 *
 * @returns Rig and top face target.
 */
function sculptTestTopFaceCreate(): { rig: DisplacementTestRig; target: SolidFaceTextureTarget } {
  const rig = displacementTestRigCreate('SculptTest');
  const brush = displacementTestBoxAdd(rig, SCULPT_TEST_BOX_EDGES, SCULPT_TEST_BOX_CENTER);
  const target = displacementTestTarget(rig, brush, displacementTestFaceFacing(brush, new THREE.Vector3(0, 1, 0)));
  return { rig, target };
}

/**
 * Unit tests for displacement creation, painting, smoothing, noise, sewing and
 * undo.
 */
describe('displacement sculpting', () => {
  it('creates power 2 and power 3 grids on a real box face with a matching surface mesh', () => {
    for (const power of [2, 3] as const) {
      const { rig, target } = sculptTestTopFaceCreate();
      displacementTestCreate(rig, target, power);
      expect(displacementTestOffsetsRead(target)).toHaveLength(displacementVertexCount(power));
      const mesh = displacementTestSurfaceMeshFind(rig, target);
      expect(mesh?.geometry.getAttribute('position').count).toBe(displacementVertexCount(power));
      const topY = SCULPT_TEST_BOX_CENTER.y + SCULPT_TEST_BOX_EDGES.y / 2;
      displacementTestWorldPositions(target).forEach((point) => expect(point.y).toBeCloseTo(topY, 5));
    }
  });

  it('raises the face center with one paint stroke and leaves vertices beyond the radius alone', () => {
    const { rig, target } = sculptTestTopFaceCreate();
    displacementTestCreate(rig, target, 3);
    const center = displacementTestFaceCenter(target);
    const radius = SCULPT_TEST_BOX_EDGES.x / 4;
    const undoCountBefore = rig.commandStack.getUndoCount();
    const stroke = new DisplacementSculptStroke(
      rig.commandStack,
      [target],
      displacementTestStrokeSettings({ effect: 'raise_lower', radius, distance: 0.25, direction: 1 }),
    );
    stroke.dabApply(center);
    stroke.dabApply(center);
    expect(stroke.finish()).toBe(2);
    expect(rig.commandStack.getUndoCount()).toBe(undoCountBefore + 1);
    const positions = displacementTestWorldPositions(target);
    const flatY = center.y;
    positions.forEach((point) => {
      const reach = Math.hypot(point.x - center.x, point.z - center.z);
      if (reach >= radius) expect(point.y).toBeCloseTo(flatY, 6);
      if (reach < 1e-6) expect(point.y).toBeGreaterThan(flatY + 0.25);
    });
  });

  it('undoes and redoes a whole stroke as one step', () => {
    const { rig, target } = sculptTestTopFaceCreate();
    displacementTestCreate(rig, target, 2);
    const flatOffsets = displacementTestOffsetsRead(target);
    const stroke = new DisplacementSculptStroke(
      rig.commandStack,
      [target],
      displacementTestStrokeSettings({
        effect: 'raise_lower',
        radius: SCULPT_TEST_BOX_EDGES.x,
        distance: 0.5,
        direction: -1,
      }),
    );
    stroke.dabApply(displacementTestFaceCenter(target));
    stroke.dabApply(displacementTestFaceCenter(target));
    stroke.finish();
    const sculpted = displacementTestOffsetsRead(target);
    expect(sculpted).not.toEqual(flatOffsets);
    rig.commandStack.undo();
    expect(displacementTestOffsetsRead(target)).toEqual(flatOffsets);
    rig.commandStack.redo();
    expect(displacementTestOffsetsRead(target)).toEqual(sculpted);
    rig.commandStack.undo();
    rig.commandStack.undo();
    expect(displacementTestOffsetsRead(target)).toEqual([]);
    expect(displacementTestSurfaceMeshFind(rig, target)).toBeUndefined();
  });

  it('smooths a single spike into its neighbors', () => {
    const displacement = displacementSurfaceCreate(2);
    const rowLength = displacementRowLength(2);
    const spikeIndex = Math.floor(rowLength / 2) * rowLength + Math.floor(rowLength / 2);
    displacement.offsets[spikeIndex] = 9;
    DisplacementSculptOps.smoothGeometry(displacement);
    expect(displacement.offsets[spikeIndex]).toBeLessThan(9);
    expect(displacement.offsets[spikeIndex]).toBeGreaterThan(0);
    expect(displacement.offsets[spikeIndex + 1]).toBeGreaterThan(0);
    expect(displacement.offsets[spikeIndex + rowLength]).toBeGreaterThan(0);
    expect(displacement.offsets[0]).toBe(0);
  });

  it('adds seeded noise inside the requested range', () => {
    const minDistance = -0.2;
    const maxDistance = 0.3;
    const first = displacementSurfaceCreate(3);
    const second = displacementSurfaceClone(first);
    const third = displacementSurfaceClone(first);
    DisplacementSculptOps.applyNoise(first, minDistance, maxDistance, 7);
    DisplacementSculptOps.applyNoise(second, minDistance, maxDistance, 7);
    DisplacementSculptOps.applyNoise(third, minDistance, maxDistance, 8);
    expect(first.offsets).toEqual(second.offsets);
    expect(first.offsets).not.toEqual(third.offsets);
    first.offsets.forEach((offset) => {
      expect(offset).toBeGreaterThanOrEqual(minDistance);
      expect(offset).toBeLessThanOrEqual(maxDistance);
    });
  });

  it('subdivides one power up and keeps the corner heights', () => {
    for (const power of DISPLACEMENT_POWERS) {
      const displacement = displacementSurfaceCreate(power);
      DisplacementSculptOps.applyNoise(displacement, -1, 1, power);
      const subdivided = DisplacementSculptOps.subdivide(displacement);
      if (power === DISPLACEMENT_POWERS[DISPLACEMENT_POWERS.length - 1]) {
        expect(subdivided).toBeNull();
        continue;
      }
      if (!subdivided) throw new Error('subdivide failed');
      expect(subdivided.power).toBe(power + 1);
      const lastSource = displacement.offsets.length - 1;
      const lastTarget = subdivided.offsets.length - 1;
      expect(subdivided.offsets[0]).toBeCloseTo(displacement.offsets[0] ?? Number.NaN, 9);
      expect(subdivided.offsets[lastTarget]).toBeCloseTo(displacement.offsets[lastSource] ?? Number.NaN, 9);
    }
  });

  it('sews the shared edge of two neighboring displaced faces on different brushes', () => {
    const rig = displacementTestRigCreate('SewTest');
    const leftCenter = new THREE.Vector3(-3, 1, 2);
    const left = displacementTestBoxAdd(rig, SCULPT_TEST_BOX_EDGES, leftCenter);
    const right = displacementTestBoxAdd(
      rig,
      SCULPT_TEST_BOX_EDGES,
      leftCenter.clone().add(new THREE.Vector3(SCULPT_TEST_BOX_EDGES.x, 0, 0)),
    );
    const up = new THREE.Vector3(0, 1, 0);
    const targets = [left, right].map((brush) =>
      displacementTestTarget(rig, brush, displacementTestFaceFacing(brush, up)),
    );
    targets.forEach((target, index) => {
      const displacement = displacementSurfaceCreate(3);
      DisplacementSculptOps.applyNoise(displacement, -0.5, 0.5, 11 + index);
      displacementTestStore(rig, target, displacement);
    });
    const changed = DisplacementSew.sewSharedEdges(DisplacementSculptFace.listFromTargets(targets));
    expect(changed.length).toBe(2);
    rig.commandStack.push(new CommandDisplacementEdit(changed.map((face) => face.editBuild())));
    displacementTestSharedEdgeExpectSewn(targets);
    targets.forEach((target) => {
      const stored = target.model.findBrush(target.brushId)?.faceDisplacementRead(target.surfaceIndex);
      expect(stored?.seamOffsets).toBeUndefined();
    });
  });

  it('sews the shared edge of two neighboring brushes that are rotated and scaled together', () => {
    const rig = displacementTestRigCreate('SewRotatedTest');
    const leftCenter = new THREE.Vector3(-3, 1, 2);
    const brushes = [
      displacementTestBoxAdd(rig, SCULPT_TEST_BOX_EDGES, leftCenter),
      displacementTestBoxAdd(
        rig,
        SCULPT_TEST_BOX_EDGES,
        leftCenter.clone().setX(leftCenter.x + SCULPT_TEST_BOX_EDGES.x),
      ),
    ];
    const rotation = new THREE.Euler(0.31, 0.83, -0.27);
    const scale = new THREE.Vector3(1.37, 0.71, 1.13);
    brushes.forEach((brush) => sculptTestBrushTransformAround(brush, leftCenter, rotation, scale));
    rig.model.rebuild(true);
    const targets = brushes.map((brush) =>
      displacementTestTarget(rig, brush, displacementTestFaceFacing(brush, new THREE.Vector3(0, 1, 0))),
    );
    targets.forEach((target, index) => {
      const displacement = displacementSurfaceCreate(3);
      DisplacementSculptOps.applyNoise(displacement, -0.5, 0.5, 23 + index);
      displacementTestStore(rig, target, displacement);
    });
    const changed = DisplacementSew.sewSharedEdges(DisplacementSculptFace.listFromTargets(targets));
    expect(changed.length).toBe(2);
    rig.commandStack.push(new CommandDisplacementEdit(changed.map((face) => face.editBuild())));
    displacementTestSharedEdgeExpectSewn(targets);
  });

  it('sews shared edges at the end of an AutoSew stroke and undoes stroke and sew as one step', () => {
    const { rig, targets } = sculptTestNeighborTopFacesCreate('AutoSewTest');
    const flatOffsets = targets.map((target) => displacementTestOffsetsRead(target));
    const sharedEdgeCenter = targets
      .map((target) => displacementTestFaceCenter(target))
      .reduce((sum, center) => sum.add(center), new THREE.Vector3())
      .multiplyScalar(0.5);
    const undoCountBefore = rig.commandStack.getUndoCount();
    const stroke = new DisplacementSculptStroke(
      rig.commandStack,
      targets,
      displacementTestStrokeSettings({
        effect: 'noise',
        edge: 'hard',
        radius: SCULPT_TEST_BOX_EDGES.x,
        distance: 0.4,
        seed: 17,
        autoSew: true,
      }),
    );
    expect(stroke.dabApply(sharedEdgeCenter)).toBe(2);
    expect(stroke.finish()).toBe(1);
    expect(rig.commandStack.getUndoCount()).toBe(undoCountBefore + 1);
    displacementTestSharedEdgeExpectSewn(targets);
    rig.commandStack.undo();
    targets.forEach((target, index) => expect(displacementTestOffsetsRead(target)).toEqual(flatOffsets[index]));
  });

  it('leaves noisy shared edges unsewn when AutoSew is off', () => {
    const { rig, targets } = sculptTestNeighborTopFacesCreate('NoAutoSewTest');
    const stroke = new DisplacementSculptStroke(
      rig.commandStack,
      targets,
      displacementTestStrokeSettings({ effect: 'noise', edge: 'hard', radius: SCULPT_TEST_BOX_EDGES.x * 2, seed: 17 }),
    );
    stroke.dabApply(displacementTestFaceCenter(targets[0] as SolidFaceTextureTarget));
    stroke.finish();
    expect(DisplacementSew.sewSharedEdges(DisplacementSculptFace.listFromTargets(targets)).length).toBeGreaterThan(0);
  });
});

/**
 * Builds two boxes side by side along X whose upward faces carry flat power 3
 * displacements.
 *
 * @param name Model name.
 * @returns Rig and the two upward face targets.
 */
function sculptTestNeighborTopFacesCreate(name: string): {
  rig: DisplacementTestRig;
  targets: SolidFaceTextureTarget[];
} {
  const rig = displacementTestRigCreate(name);
  const leftCenter = new THREE.Vector3(2, -1, -3);
  const brushes = [leftCenter, leftCenter.clone().setX(leftCenter.x + SCULPT_TEST_BOX_EDGES.x)].map((center) =>
    displacementTestBoxAdd(rig, SCULPT_TEST_BOX_EDGES, center),
  );
  const targets = brushes.map((brush) =>
    displacementTestTarget(rig, brush, displacementTestFaceFacing(brush, new THREE.Vector3(0, 1, 0))),
  );
  targets.forEach((target) => displacementTestCreate(rig, target, 3));
  return { rig, targets };
}

/**
 * Applies a rotation and scale about a pivot to a brush, moving its position so
 * neighboring brushes transformed the same way stay attached.
 *
 * @param brush Brush to transform.
 * @param pivot World pivot of the shared transform.
 * @param rotation Shared rotation.
 * @param scale Shared scale, applied in the rotated frame.
 */
function sculptTestBrushTransformAround(
  brush: SolidBrushInstance,
  pivot: THREE.Vector3,
  rotation: THREE.Euler,
  scale: THREE.Vector3,
): void {
  const fromPivot = brush.position.clone().sub(pivot).multiply(scale).applyEuler(rotation);
  brush.position.copy(pivot).add(fromPivot);
  brush.rotation.copy(rotation);
  brush.scale.copy(scale);
  brush.pushTransformToMesh();
}
