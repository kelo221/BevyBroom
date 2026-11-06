import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SolidModel } from '@/solid/model/solid_model.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';
import { CommandSolidBrushSplit } from '@/solid/commands/brush/command_solid_brush_split.js';
import { displacementSurfaceCreate } from '@/displacement/model/displacement_face_surface.js';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';

/** Unit tests for splitting a solid brush and remapping its displacements. */
describe('CommandSolidBrushSplit', () => {
  it('remaps a displacement onto matching faces of both pieces and restores it on undo', () => {
    const model = new SolidModel('SplitDisplacement');
    const instance = model.addBoxBrush(2, SolidOperation.Additive);
    const sideIndex = faceIndexAlongAxis(instance, new THREE.Vector3(0, 0, 1));
    expect(sideIndex).toBeGreaterThanOrEqual(0);
    instance.faceDisplacementWrite(sideIndex, displacementSurfaceCreate(2, 0.5));
    const command = splitBrushAlongX(model, instance.id);
    expect(command.didSplit()).toBe(true);
    expect(model.findBrush(instance.id)).toBeUndefined();
    expect(model.getBrushes()).toHaveLength(2);
    expect(model.getBrushes().every((piece) => pieceHasElevationOnAxis(piece, new THREE.Vector3(0, 0, 1), 0.5))).toBe(
      true,
    );
    command.undo();
    expect(model.findBrush(instance.id)?.faceDisplacementRead(sideIndex)?.elevation).toBe(0.5);
  });
});

/**
 * Splits a brush on the world YZ plane through the origin.
 *
 * @param model Owning solid model.
 * @param brushId Brush to split.
 * @returns Executed split command.
 */
function splitBrushAlongX(model: SolidModel, brushId: string): CommandSolidBrushSplit {
  const command = new CommandSolidBrushSplit(model, brushId, new THREE.Plane(new THREE.Vector3(1, 0, 0), 0));
  command.execute();
  return command;
}

/**
 * Returns the first face whose plane normal matches the given direction.
 *
 * @param instance Brush instance.
 * @param direction Unit axis to match.
 * @returns Face index, or -1.
 */
function faceIndexAlongAxis(instance: SolidBrushInstance, direction: THREE.Vector3): number {
  return instance.brush.planes.findIndex((plane) => plane.normal.dot(direction) > 0.9);
}

/**
 * Returns whether a brush has a displacement of the given elevation on the face
 * matching a direction.
 *
 * @param instance Brush instance.
 * @param direction Unit axis to match.
 * @param elevation Expected elevation.
 * @returns True when that face carries the elevation.
 */
function pieceHasElevationOnAxis(instance: SolidBrushInstance, direction: THREE.Vector3, elevation: number): boolean {
  const faceIndex = faceIndexAlongAxis(instance, direction);
  return instance.faceDisplacementRead(faceIndex)?.elevation === elevation;
}
