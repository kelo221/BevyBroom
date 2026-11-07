import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { SolidModelCodec } from '@/solid/io/solid_model_codec.js';
import { displacementSurfaceCreate, displacementVertexCount } from '@/displacement/model/displacement_face_surface.js';
import { DisplacementSculptOps } from '@/displacement/sculpt/displacement_sculpt_ops.js';
import { CommandDisplacementEdit } from '@/displacement/commands/command_displacement_edit.js';
import { displacementSurfaceMeshesUnder } from '@/displacement/mesh/displacement_surface_mesh_keys.js';
import { DisplacementSew } from '@/displacement/sculpt/displacement_sew.js';
import { DisplacementSculptFace } from '@/displacement/sculpt/displacement_sculpt_face.js';
import {
  displacementTestBoxAdd,
  displacementTestFaceFacing,
  displacementTestRigCreate,
  displacementTestTarget,
} from '../../displacement/displacement_test_rig.js';

/** Saving and loading displaced brush faces through the solid model codec. */
describe('SolidModelCodec displacements', () => {
  it('round-trips a sculpted displacement through JSON and shows it after loading', () => {
    const rig = displacementTestRigCreate('CodecDisplacement');
    const brush = displacementTestBoxAdd(rig, new THREE.Vector3(3, 1, 2), new THREE.Vector3(-1, 2, 4));
    const surfaceIndex = displacementTestFaceFacing(brush, new THREE.Vector3(0, 0, 1));
    const displacement = displacementSurfaceCreate(3, 0.125);
    DisplacementSculptOps.applyNoise(displacement, -0.3, 0.3, 5);
    displacement.alphas = displacement.alphas.map((_alpha, index) => index % 256);
    displacement.scale = 1.5;
    rig.commandStack.push(
      new CommandDisplacementEdit([{ target: displacementTestTarget(rig, brush, surfaceIndex), displacement }]),
    );
    const encoded = JSON.parse(JSON.stringify(SolidModelCodec.encode(rig.model))) as ReturnType<
      typeof SolidModelCodec.encode
    >;
    const restored = SolidModelCodec.decode(encoded, 'CodecDisplacementRestored');
    const restoredBrush = restored.getBrushes()[0];
    expect(restoredBrush?.faceDisplacementRead(surfaceIndex)).toEqual(displacement);
    expect(restoredBrush?.faceDisplacementIndices()).toEqual([surfaceIndex]);
    const surfaceMeshes = displacementSurfaceMeshesUnder(restored.root);
    expect(surfaceMeshes).toHaveLength(1);
    expect(surfaceMeshes[0]?.geometry.getAttribute('position').count).toBe(displacementVertexCount(3));
  });

  it('round-trips the seam offsets of a sew between perpendicular faces', () => {
    const rig = displacementTestRigCreate('CodecSeams');
    const brush = displacementTestBoxAdd(rig, new THREE.Vector3(2, 3, 2), new THREE.Vector3(1, -1, 2));
    const targets = [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1)].map((direction) =>
      displacementTestTarget(rig, brush, displacementTestFaceFacing(brush, direction)),
    );
    const edits = targets.map((target, index) => {
      const displacement = displacementSurfaceCreate(2);
      DisplacementSculptOps.applyNoise(displacement, -0.4, 0.4, 13 + index);
      return { target, displacement };
    });
    rig.commandStack.push(new CommandDisplacementEdit(edits));
    const sewn = DisplacementSew.sewSharedEdges(DisplacementSculptFace.listFromTargets(targets));
    rig.commandStack.push(new CommandDisplacementEdit(sewn.map((face) => face.editBuild())));
    const encoded = JSON.parse(JSON.stringify(SolidModelCodec.encode(rig.model))) as ReturnType<
      typeof SolidModelCodec.encode
    >;
    const restoredBrush = SolidModelCodec.decode(encoded, 'CodecSeamsRestored').getBrushes()[0];
    targets.forEach((target) => {
      const stored = brush.faceDisplacementRead(target.surfaceIndex);
      expect(stored?.seamOffsets).toBeDefined();
      expect(restoredBrush?.faceDisplacementRead(target.surfaceIndex)).toEqual(stored);
    });
  });

  it('round-trips collision flags, writing them only for surfaces with a flag on', () => {
    const rig = displacementTestRigCreate('CodecFlags');
    const brush = displacementTestBoxAdd(rig, new THREE.Vector3(2, 1, 2), new THREE.Vector3(3, 0, -2));
    const flaggedIndex = displacementTestFaceFacing(brush, new THREE.Vector3(0, 1, 0));
    const plainIndex = displacementTestFaceFacing(brush, new THREE.Vector3(0, -1, 0));
    const flagged = displacementSurfaceCreate(2);
    flagged.flags = { noPhysicsCollision: true, noHullCollision: false, noRayCollision: true, seals: true };
    rig.commandStack.push(
      new CommandDisplacementEdit([
        { target: displacementTestTarget(rig, brush, flaggedIndex), displacement: flagged },
        { target: displacementTestTarget(rig, brush, plainIndex), displacement: displacementSurfaceCreate(2) },
      ]),
    );
    const encoded = JSON.parse(JSON.stringify(SolidModelCodec.encode(rig.model))) as ReturnType<
      typeof SolidModelCodec.encode
    >;
    const serializedDisplacements = encoded.brushes[0]?.faceDisplacements ?? [];
    expect(serializedDisplacements[flaggedIndex]?.flags).toEqual(flagged.flags);
    expect(serializedDisplacements[plainIndex]).toBeDefined();
    expect(serializedDisplacements[plainIndex]?.flags).toBeUndefined();
    const restoredBrush = SolidModelCodec.decode(encoded, 'CodecFlagsRestored').getBrushes()[0];
    expect(restoredBrush?.faceDisplacementRead(flaggedIndex)?.flags).toEqual(flagged.flags);
    expect(restoredBrush?.faceDisplacementRead(plainIndex)?.flags).toEqual(displacementSurfaceCreate(2).flags);
  });

  it('loads saved displacements written before collision flags existed with every flag off', () => {
    const rig = displacementTestRigCreate('CodecLegacyFlags');
    const brush = displacementTestBoxAdd(rig, new THREE.Vector3(2, 2, 2), new THREE.Vector3(-2, 1, 1));
    const encoded = SolidModelCodec.encode(rig.model);
    const serializedBrush = encoded.brushes[0];
    if (!serializedBrush) throw new Error('brush missing from encoding');
    const { flags: _unusedFlags, ...legacyEntry } = displacementSurfaceCreate(3, 0.2);
    serializedBrush.faceDisplacements = brush.brush.faces.map((_face, index) => (index === 0 ? legacyEntry : null));
    const restored = SolidModelCodec.decode(encoded, 'CodecLegacyFlagsRestored').getBrushes()[0];
    expect(restored?.faceDisplacementRead(0)?.elevation).toBe(0.2);
    expect(restored?.faceDisplacementRead(0)?.flags).toEqual({
      noPhysicsCollision: false,
      noHullCollision: false,
      noRayCollision: false,
      seals: false,
    });
  });

  it('writes no displacement list for brushes without displacements', () => {
    const rig = displacementTestRigCreate('CodecFlat');
    displacementTestBoxAdd(rig, new THREE.Vector3(1, 1, 1), new THREE.Vector3(0, 0, 0));
    const encoded = SolidModelCodec.encode(rig.model);
    encoded.brushes.forEach((serializedBrush) => expect(serializedBrush.faceDisplacements).toBeUndefined());
  });

  it('drops malformed displacement entries while loading', () => {
    const rig = displacementTestRigCreate('CodecMalformed');
    const brush = displacementTestBoxAdd(rig, new THREE.Vector3(2, 2, 2), new THREE.Vector3(0, 1, 0));
    const encoded = SolidModelCodec.encode(rig.model);
    const serializedBrush = encoded.brushes[0];
    if (!serializedBrush) throw new Error('brush missing from encoding');
    const brokenEntry = { ...displacementSurfaceCreate(2), offsets: [1, 2, 3] };
    serializedBrush.faceDisplacements = brush.brush.faces.map((_face, index) => (index === 0 ? brokenEntry : null));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const restored = SolidModelCodec.decode(encoded, 'CodecMalformedRestored');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
    expect(restored.getBrushes()[0]?.faceDisplacementIndices()).toEqual([]);
    expect(displacementSurfaceMeshesUnder(restored.root)).toHaveLength(0);
  });
});
