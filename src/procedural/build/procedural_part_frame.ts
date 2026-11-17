import * as THREE from 'three';
import type { ProceduralPart } from '@/procedural/build/procedural_part.js';
import { ProceduralPartBox } from '@/procedural/build/procedural_part_box.js';

/** A box in frame space: its extent along the run, up and across. */
export interface ProceduralPartFrameBox {
  readonly runFrom: number;
  readonly runTo: number;
  readonly upFrom: number;
  readonly upTo: number;
  readonly acrossFrom: number;
  readonly acrossTo: number;
}

/**
 * A frame for building parts along a path: X runs along a horizontal direction,
 * Y is up and Z points across, with its origin on a point of the owner's space.
 * Boxes built in it may be sheared so they rise along the run, which keeps them
 * convex.
 */
export class ProceduralPartFrame {
  private readonly frameToOwner: THREE.Matrix4;

  /**
   * Creates a frame.
   *
   * @param origin Frame origin in owner space.
   * @param runDirection Horizontal direction of the run in owner space; the
   *   owner's X axis when it has no horizontal length.
   */
  constructor(origin: THREE.Vector3, runDirection: THREE.Vector3) {
    const run = ProceduralPartFrame.runDirectionOf(runDirection);
    const across = ProceduralPartFrame.acrossDirectionOf(runDirection);
    this.frameToOwner = new THREE.Matrix4().makeBasis(run, new THREE.Vector3(0, 1, 0), across).setPosition(origin);
  }

  /**
   * Returns the unit horizontal run direction of a direction.
   *
   * @param direction Any direction in owner space.
   * @returns Its horizontal part, normalized, or the owner's X axis when it has
   *   no horizontal length.
   */
  static runDirectionOf(direction: THREE.Vector3): THREE.Vector3 {
    const run = new THREE.Vector3(direction.x, 0, direction.z);
    return run.lengthSq() < 1e-12 ? new THREE.Vector3(1, 0, 0) : run.normalize();
  }

  /**
   * Returns the unit horizontal direction across a run, to its right when
   * looking along the run from above.
   *
   * @param direction Any direction in owner space.
   * @returns Unit across direction.
   */
  static acrossDirectionOf(direction: THREE.Vector3): THREE.Vector3 {
    return new THREE.Vector3().crossVectors(ProceduralPartFrame.runDirectionOf(direction), new THREE.Vector3(0, 1, 0));
  }

  /**
   * Returns a frame point in owner space.
   *
   * @param run Distance along the run.
   * @param up Height.
   * @param across Distance across.
   * @returns Owner-space point.
   */
  pointToOwner(run: number, up: number, across: number): THREE.Vector3 {
    return new THREE.Vector3(run, up, across).applyMatrix4(this.frameToOwner);
  }

  /**
   * Builds a box part in the frame, raised by `slope` meters per meter of run.
   *
   * @param name Part name.
   * @param materialSlot Material slot that textures the part.
   * @param box Extent in frame space before the slope.
   * @param slope Rise per meter of run; zero for a level box.
   * @returns Convex part in owner space.
   */
  boxPart(name: string, materialSlot: string, box: ProceduralPartFrameBox, slope = 0): ProceduralPart {
    const minimum = new THREE.Vector3(box.runFrom, box.upFrom, box.acrossFrom);
    const maximum = new THREE.Vector3(box.runTo, box.upTo, box.acrossTo);
    const corners = ProceduralPartBox.cornersCreate(minimum, maximum).map((corner) =>
      this.pointToOwner(corner.x, corner.y + corner.x * slope, corner.z),
    );
    return ProceduralPartBox.fromCorners(name, materialSlot, corners);
  }
}
