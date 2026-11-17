import * as THREE from 'three';
import type { ProceduralPart } from '@/procedural/build/procedural_part.js';

/** Corner indices of the six box faces, counter-clockwise seen from outside. */
const PROCEDURAL_PART_BOX_FACE_CORNERS: readonly (readonly number[])[] = [
  [1, 3, 7, 5],
  [0, 4, 6, 2],
  [2, 6, 7, 3],
  [0, 1, 5, 4],
  [4, 5, 7, 6],
  [0, 2, 3, 1],
];

/** Builds axis-aligned box parts, the convex piece most generators are made of. */
export class ProceduralPartBox {
  /**
   * Creates the part of an axis-aligned box between two opposite corners.
   *
   * @param name Part name.
   * @param materialSlot Material slot that textures the part.
   * @param cornerMinimum Corner with the smallest coordinates.
   * @param cornerMaximum Corner with the largest coordinates.
   * @returns Box part with six quad faces.
   */
  static create(
    name: string,
    materialSlot: string,
    cornerMinimum: THREE.Vector3,
    cornerMaximum: THREE.Vector3,
  ): ProceduralPart {
    const corners = ProceduralPartBox.cornersCreate(cornerMinimum, cornerMaximum);
    const faces = PROCEDURAL_PART_BOX_FACE_CORNERS.map((indices) =>
      indices.map((index) => (corners[index] ?? cornerMinimum).clone()),
    );
    return { name, materialSlot, faces };
  }

  /**
   * Returns the eight box corners; bit 0 of the index picks maximum X, bit 1
   * maximum Y and bit 2 maximum Z.
   *
   * @param cornerMinimum Corner with the smallest coordinates.
   * @param cornerMaximum Corner with the largest coordinates.
   * @returns Corners by index.
   */
  private static cornersCreate(cornerMinimum: THREE.Vector3, cornerMaximum: THREE.Vector3): THREE.Vector3[] {
    const corners: THREE.Vector3[] = [];
    for (let index = 0; index < 8; index++) {
      corners.push(
        new THREE.Vector3(
          index & 1 ? cornerMaximum.x : cornerMinimum.x,
          index & 2 ? cornerMaximum.y : cornerMinimum.y,
          index & 4 ? cornerMaximum.z : cornerMinimum.z,
        ),
      );
    }
    return corners;
  }
}
