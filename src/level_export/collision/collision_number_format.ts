import type * as THREE from 'three';
import type { CollisionVector3 } from '@/level_export/collision/collision_types.js';

/**
 * Decimal places every exported coordinate keeps, so the same document gives
 * the same bytes.
 */
const COLLISION_NUMBER_DECIMALS = 6;

/** Formats numbers of exported level data with a fixed precision. */
export class CollisionNumberFormat {
  /**
   * Rounds a number to the exported precision, without negative zero.
   *
   * @param value Any finite number.
   * @returns Rounded number.
   */
  static round(value: number): number {
    const rounded = Number(value.toFixed(COLLISION_NUMBER_DECIMALS));
    return rounded === 0 ? 0 : rounded;
  }

  /**
   * Returns a vector as a rounded `[x, y, z]`.
   *
   * @param vector Vector.
   * @returns Rounded triple.
   */
  static vector3(vector: THREE.Vector3): CollisionVector3 {
    return [
      CollisionNumberFormat.round(vector.x),
      CollisionNumberFormat.round(vector.y),
      CollisionNumberFormat.round(vector.z),
    ];
  }

  /**
   * Returns a quaternion as a rounded `[x, y, z, w]`.
   *
   * @param quaternion Quaternion.
   * @returns Rounded quadruple.
   */
  static quaternion(quaternion: THREE.Quaternion): [number, number, number, number] {
    const round = CollisionNumberFormat.round;
    return [round(quaternion.x), round(quaternion.y), round(quaternion.z), round(quaternion.w)];
  }
}
