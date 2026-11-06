import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  DISPLACEMENT_ALPHA_MAX,
  DISPLACEMENT_COLLISION_FLAG_KEYS,
  DISPLACEMENT_POWERS,
} from '@/displacement/model/displacement_types.js';
import {
  displacementOffsetDeltaForDistance,
  displacementPowerIs,
  displacementSurfaceClone,
  displacementSurfaceCreate,
  displacementSurfaceRead,
  displacementSurfaceSerialize,
  displacementVertexCount,
} from '@/displacement/model/displacement_face_surface.js';
import {
  displacementTestBoxAdd,
  displacementTestFaceFacing,
  displacementTestRigCreate,
} from '../displacement_test_rig.js';

/** Displacement data helpers and their storage on brush faces. */
describe('displacement face surface', () => {
  it('creates flat surfaces with one offset and alpha per grid vertex', () => {
    DISPLACEMENT_POWERS.forEach((power) => {
      const surface = displacementSurfaceCreate(power, 0.25);
      const rowLength = 2 ** power + 1;
      expect(displacementVertexCount(power)).toBe(rowLength * rowLength);
      expect(surface.offsets).toHaveLength(rowLength * rowLength);
      expect(surface.alphas.every((alpha) => alpha === 0)).toBe(true);
      expect(surface.elevation).toBe(0.25);
    });
    expect(displacementPowerIs(5)).toBe(false);
    expect(displacementPowerIs('3')).toBe(false);
  });

  it('reads JSON surfaces, filling missing alphas, clamping alphas and rejecting bad shapes', () => {
    const vertexCount = displacementVertexCount(2);
    const offsets = Array.from({ length: vertexCount }, (_unused, index) => index * 0.1);
    const read = displacementSurfaceRead({ power: 2, elevation: 1, offsets });
    expect(read?.offsets).toEqual(offsets);
    expect(read?.alphas).toEqual(new Array<number>(vertexCount).fill(0));
    expect(read?.scale).toBe(1);
    const clamped = displacementSurfaceRead({ power: 2, alphas: new Array<number>(vertexCount).fill(999) });
    expect(clamped?.alphas.every((alpha) => alpha === DISPLACEMENT_ALPHA_MAX)).toBe(true);
    expect(displacementSurfaceRead({ power: 2, offsets: offsets.slice(1) })).toBeNull();
    expect(displacementSurfaceRead({ power: 7 })).toBeNull();
    expect(displacementSurfaceRead('not a surface')).toBeNull();
  });

  it('clones deeply and converts distances to offsets through the scale', () => {
    const surface = displacementSurfaceCreate(3);
    const copy = displacementSurfaceClone(surface);
    copy.offsets[0] = 4;
    expect(surface.offsets[0]).toBe(0);
    surface.scale = 2;
    expect(displacementOffsetDeltaForDistance(surface, 1)).toBe(0.5);
    surface.scale = 0;
    expect(displacementOffsetDeltaForDistance(surface, 1)).toBe(1);
  });

  it('creates surfaces with every collision flag off and clones flags independently', () => {
    const surface = displacementSurfaceCreate(2);
    DISPLACEMENT_COLLISION_FLAG_KEYS.forEach((key) => expect(surface.flags[key]).toBe(false));
    const copy = displacementSurfaceClone(surface);
    copy.flags.seals = true;
    expect(surface.flags.seals).toBe(false);
  });

  it('reads collision flags, treating missing flags as off and rejecting non-boolean flags', () => {
    const withoutFlags = displacementSurfaceRead({ power: 2 });
    DISPLACEMENT_COLLISION_FLAG_KEYS.forEach((key) => expect(withoutFlags?.flags[key]).toBe(false));
    const partial = displacementSurfaceRead({ power: 2, flags: { noHullCollision: true } });
    expect(partial?.flags).toEqual({
      noPhysicsCollision: false,
      noHullCollision: true,
      noRayCollision: false,
      seals: false,
    });
    expect(displacementSurfaceRead({ power: 2, flags: { seals: 'yes' } })).toBeNull();
    expect(displacementSurfaceRead({ power: 2, flags: true })).toBeNull();
  });

  it('serializes flags only when at least one flag is on', () => {
    const surface = displacementSurfaceCreate(2);
    expect('flags' in displacementSurfaceSerialize(surface)).toBe(false);
    surface.flags.noRayCollision = true;
    const serialized = displacementSurfaceSerialize(surface);
    expect(serialized.flags?.noRayCollision).toBe(true);
    expect(displacementSurfaceRead(serialized)).toEqual(surface);
  });

  it('keeps a face displacement when the face texture or UV mapping changes', () => {
    const rig = displacementTestRigCreate('StorageTest');
    const brush = displacementTestBoxAdd(rig, new THREE.Vector3(2, 2, 2), new THREE.Vector3(0, 0, 0));
    const faceIndex = displacementTestFaceFacing(brush, new THREE.Vector3(-1, 0, 0));
    const displacement = displacementSurfaceCreate(2, 0.5);
    brush.faceDisplacementWrite(faceIndex, displacement);
    brush.setFaceTextureId(faceIndex, 'storage-wall');
    const surface = brush.getFaceSurface(faceIndex);
    brush.setFaceSurface(faceIndex, { textureId: surface.textureId, uv: surface.uv });
    expect(brush.faceDisplacementRead(faceIndex)).toEqual(displacement);
    expect(brush.getFaceSurface(faceIndex).displacement).toEqual(displacement);
    const cloned = brush.cloneWithId('storage-copy', 'Storage Copy');
    expect(cloned.faceDisplacementRead(faceIndex)).toEqual(displacement);
    brush.faceDisplacementWrite(faceIndex, null);
    expect(brush.faceDisplacementIndices()).toEqual([]);
    expect(cloned.faceDisplacementIndices()).toEqual([faceIndex]);
  });
});
