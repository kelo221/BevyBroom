import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { displacementRowLength, displacementSurfaceCreate } from '@/displacement/model/displacement_face_surface.js';
import { CommandDisplacementEdit } from '@/displacement/commands/command_displacement_edit.js';
import { DisplacementSculptFace } from '@/displacement/sculpt/displacement_sculpt_face.js';
import { DisplacementSculptOps } from '@/displacement/sculpt/displacement_sculpt_ops.js';
import { DisplacementSculptStroke } from '@/displacement/sculpt/displacement_sculpt_stroke.js';
import { DisplacementSew } from '@/displacement/sculpt/displacement_sew.js';
import { displacementSurfaceMeshNameBuild } from '@/displacement/mesh/displacement_surface_mesh_keys.js';
import { applyObjectTransformToSolidBrush } from '@/transform/apply/object_apply_transform_brush.js';
import { GlbExporter } from '@/io/glb/glb_exporter.js';
import type { SolidFaceTextureTarget } from '@/texture/commands/command_texture_solid_face_edit.js';
import { glbNodePositionsRead, glbPositionsCoincidentCountRead } from '../../io/glb/glb_node_positions_read.js';
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

/** Edge lengths of the test box. */
const SEW_TEST_BOX_EDGES = new THREE.Vector3(4, 2, 4);

/** World center of the test box. */
const SEW_TEST_BOX_CENTER = new THREE.Vector3(1, 3, -2);

/**
 * Unit tests for sewing displaced faces with different normals: exact seams
 * through seam offsets, transforms, undo, painting after a sew, AutoSew and GLB
 * export.
 */
describe('displacement sew across different normals', () => {
  it('sews the shared edge of the top and a side face of one box exactly despite their different normals', () => {
    const { rig, targets } = sewTestPerpendicularFacesCreate('SewPerpendicularTest', null);
    sewTestNoiseStore(rig, targets, 31);
    const changed = DisplacementSew.sewSharedEdges(DisplacementSculptFace.listFromTargets(targets));
    expect(changed.length).toBe(2);
    rig.commandStack.push(new CommandDisplacementEdit(changed.map((face) => face.editBuild())));
    displacementTestSharedEdgeExpectSewn(targets);
    expect(sewTestSeamOffsetsRead(targets).some((seamOffsets) => seamOffsets !== undefined)).toBe(true);
    expect(DisplacementSew.sewSharedEdges(DisplacementSculptFace.listFromTargets(targets))).toEqual([]);
  });

  it('sews perpendicular faces of a rotated and scaled box and keeps the seam on the surface meshes', () => {
    const { rig, targets } = sewTestPerpendicularFacesCreate('SewPerpendicularRotatedTest', {
      rotation: new THREE.Euler(0.43, -0.71, 0.19),
      scale: new THREE.Vector3(1.21, 0.83, 1.47),
    });
    sewTestNoiseStore(rig, targets, 37);
    const changed = DisplacementSew.sewSharedEdges(DisplacementSculptFace.listFromTargets(targets));
    rig.commandStack.push(new CommandDisplacementEdit(changed.map((face) => face.editBuild())));
    displacementTestSharedEdgeExpectSewn(targets);
    sewTestSurfaceMeshesExpectMatchPlacement(rig, targets);
  });

  it('keeps a perpendicular seam sewn after the brush rotation and scale are baked into its vertices', () => {
    const { rig, targets } = sewTestPerpendicularFacesCreate('SewPerpendicularBakeTest', {
      rotation: new THREE.Euler(-0.37, 0.52, 0.88),
      scale: new THREE.Vector3(0.77, 1.31, 1.09),
    });
    sewTestNoiseStore(rig, targets, 47);
    const changed = DisplacementSew.sewSharedEdges(DisplacementSculptFace.listFromTargets(targets));
    rig.commandStack.push(new CommandDisplacementEdit(changed.map((face) => face.editBuild())));
    const brush = rig.model.findBrush(targets[0]?.brushId ?? '');
    if (!brush) throw new Error('brush is missing');
    expect(
      applyObjectTransformToSolidBrush(rig.model, brush, { location: true, rotation: true, scale: true }),
    ).not.toBeNull();
    rig.model.rebuild(true);
    expect(brush.rotation.toArray().slice(0, 3)).toEqual([0, 0, 0]);
    expect(brush.scale.toArray()).toEqual([1, 1, 1]);
    displacementTestSharedEdgeExpectSewn(targets);
  });

  it('undoes a perpendicular sew back to the unsewn offsets without seam offsets and redoes it', () => {
    const { rig, targets } = sewTestPerpendicularFacesCreate('SewPerpendicularUndoTest', null);
    sewTestNoiseStore(rig, targets, 41);
    const offsetsBefore = targets.map((target) => displacementTestOffsetsRead(target));
    const changed = DisplacementSew.sewSharedEdges(DisplacementSculptFace.listFromTargets(targets));
    rig.commandStack.push(new CommandDisplacementEdit(changed.map((face) => face.editBuild())));
    const seamOffsetsSewn = sewTestSeamOffsetsRead(targets);
    rig.commandStack.undo();
    expect(sewTestSeamOffsetsRead(targets)).toEqual([undefined, undefined]);
    targets.forEach((target, index) => expect(displacementTestOffsetsRead(target)).toEqual(offsetsBefore[index]));
    rig.commandStack.redo();
    expect(sewTestSeamOffsetsRead(targets)).toEqual(seamOffsetsSewn);
    displacementTestSharedEdgeExpectSewn(targets);
  });

  it('keeps the seam offsets of sewn vertices when a later dab paints the faces', () => {
    const { rig, targets } = sewTestPerpendicularFacesCreate('SewPerpendicularPaintTest', null);
    sewTestNoiseStore(rig, targets, 43);
    const changed = DisplacementSew.sewSharedEdges(DisplacementSculptFace.listFromTargets(targets));
    rig.commandStack.push(new CommandDisplacementEdit(changed.map((face) => face.editBuild())));
    const seamOffsetsSewn = sewTestSeamOffsetsRead(targets);
    const stroke = new DisplacementSculptStroke(
      rig.commandStack,
      targets,
      displacementTestStrokeSettings({ effect: 'raise_lower', radius: SEW_TEST_BOX_EDGES.x, distance: 0.1 }),
    );
    stroke.dabApply(displacementTestFaceCenter(targets[0] as SolidFaceTextureTarget));
    stroke.finish();
    expect(sewTestSeamOffsetsRead(targets)).toEqual(seamOffsetsSewn);
  });

  it('sews perpendicular faces exactly at the end of an AutoSew stroke along their shared edge', () => {
    const { rig, targets } = sewTestPerpendicularFacesCreate('AutoSewPerpendicularTest', null);
    const sharedEdgeCenter = sewTestSharedEdgeCenterRead(targets);
    const stroke = new DisplacementSculptStroke(
      rig.commandStack,
      targets,
      displacementTestStrokeSettings({
        effect: 'noise',
        edge: 'hard',
        radius: SEW_TEST_BOX_EDGES.x,
        distance: 0.4,
        seed: 19,
        autoSew: true,
      }),
    );
    expect(stroke.dabApply(sharedEdgeCenter)).toBe(2);
    stroke.finish();
    displacementTestSharedEdgeExpectSewn(targets);
    rig.commandStack.undo();
    expect(sewTestSeamOffsetsRead(targets)).toEqual([undefined, undefined]);
  });

  it('exports the sewn surfaces to GLB with every shared edge vertex at the same point', async () => {
    const { rig, targets } = sewTestPerpendicularFacesCreate('SewPerpendicularExportTest', null);
    sewTestNoiseStore(rig, targets, 53);
    const names = targets.map((target) =>
      displacementSurfaceMeshNameBuild({ brushId: target.brushId, surfaceIndex: target.surfaceIndex }),
    );
    const coincidentCountRead = async (): Promise<number> => {
      const buffer = await new GlbExporter().exportForFile(rig.world);
      const [first, second] = names.map((name) => glbNodePositionsRead(buffer, name));
      return glbPositionsCoincidentCountRead(first ?? [], second ?? [], 1e-4);
    };
    expect(await coincidentCountRead()).toBeLessThan(displacementRowLength(3));
    const changed = DisplacementSew.sewSharedEdges(DisplacementSculptFace.listFromTargets(targets));
    rig.commandStack.push(new CommandDisplacementEdit(changed.map((face) => face.editBuild())));
    expect(await coincidentCountRead()).toBe(displacementRowLength(3));
  });
});

/** Rotation and scale given to the brush of a perpendicular-face test. */
interface SewTestBrushPose {
  /** Brush rotation. */
  rotation: THREE.Euler;
  /** Brush scale. */
  scale: THREE.Vector3;
}

/**
 * Builds one box whose upward and +X faces (in brush space) carry flat power 3
 * displacements, so the two faces share one edge and have perpendicular
 * normals.
 *
 * @param name Model name.
 * @param pose Rotation and scale given to the brush, or null for none.
 * @returns Rig and the upward and side face targets.
 */
function sewTestPerpendicularFacesCreate(
  name: string,
  pose: SewTestBrushPose | null,
): { rig: DisplacementTestRig; targets: SolidFaceTextureTarget[] } {
  const rig = displacementTestRigCreate(name);
  const brush = displacementTestBoxAdd(rig, SEW_TEST_BOX_EDGES, SEW_TEST_BOX_CENTER);
  if (pose) {
    brush.rotation.copy(pose.rotation);
    brush.scale.copy(pose.scale);
    brush.pushTransformToMesh();
    rig.model.rebuild(true);
  }
  const targets = [new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0)].map((direction) =>
    displacementTestTarget(rig, brush, displacementTestFaceFacing(brush, direction)),
  );
  targets.forEach((target) => displacementTestCreate(rig, target, 3));
  return { rig, targets };
}

/**
 * Stores a power 3 displacement with seeded noise on every target.
 *
 * @param rig Test rig.
 * @param targets Faces to displace.
 * @param seed Noise seed of the first face; later faces count up from it.
 */
function sewTestNoiseStore(rig: DisplacementTestRig, targets: readonly SolidFaceTextureTarget[], seed: number): void {
  targets.forEach((target, index) => {
    const displacement = displacementSurfaceCreate(3);
    DisplacementSculptOps.applyNoise(displacement, -0.5, 0.5, seed + index);
    displacementTestStore(rig, target, displacement);
  });
}

/**
 * Returns copies of the stored seam offsets of every target.
 *
 * @param targets Displaced faces.
 * @returns Seam offset copy per face, undefined where a face stores none.
 */
function sewTestSeamOffsetsRead(targets: readonly SolidFaceTextureTarget[]): (number[] | undefined)[] {
  return targets.map((target) =>
    target.model.findBrush(target.brushId)?.faceDisplacementRead(target.surfaceIndex)?.seamOffsets?.slice(),
  );
}

/**
 * Returns the world center of the flat border points the first two faces share.
 *
 * @param targets Displaced faces sharing an edge.
 * @returns World-space center of the shared edge.
 */
function sewTestSharedEdgeCenterRead(targets: readonly SolidFaceTextureTarget[]): THREE.Vector3 {
  const [first, second] = targets.map((target) => DisplacementSculptFace.fromTarget(target));
  if (!first || !second) throw new Error('faces have no displacement');
  const shared = first.placement.basePositions.filter((base) =>
    second.placement.basePositions.some((other) => other.distanceTo(base) < 1e-4),
  );
  expect(shared.length).toBeGreaterThan(0);
  return shared.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / shared.length);
}

/**
 * Checks that every surface mesh vertex, placed in the world, sits where the
 * world-space placement puts the displaced vertex.
 *
 * @param rig Test rig.
 * @param targets Displaced faces.
 */
function sewTestSurfaceMeshesExpectMatchPlacement(
  rig: DisplacementTestRig,
  targets: readonly SolidFaceTextureTarget[],
): void {
  targets.forEach((target) => {
    const mesh = displacementTestSurfaceMeshFind(rig, target);
    if (!mesh) throw new Error('face shows no surface mesh');
    mesh.updateWorldMatrix(true, false);
    const meshPositions = mesh.geometry.getAttribute('position');
    displacementTestWorldPositions(target).forEach((expected, vertexIndex) => {
      const shown = new THREE.Vector3().fromBufferAttribute(meshPositions, vertexIndex).applyMatrix4(mesh.matrixWorld);
      expect(shown.distanceTo(expected)).toBeLessThan(1e-4);
    });
  });
}
