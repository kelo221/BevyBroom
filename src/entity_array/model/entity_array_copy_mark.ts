import type * as THREE from 'three';
import { entityPickDisabledSet } from '@/entity/model/entity_owner_keys.js';

/** UserData key holding the mark of an object an array made. */
export const ENTITY_ARRAY_COPY_USERDATA_KEY = 'entityArrayCopy';

/**
 * What an array copy remembers about how it was made: its cell in the array
 * and the signature of the source and settings it was built from.
 */
export interface EntityArrayCopyMarkData {
  readonly cell: readonly [number, number, number];
  readonly signature: string;
}

/**
 * Reads and writes the mark of the copies an array makes. Marked copies are
 * edited through their source, so their markers cannot be clicked.
 */
export class EntityArrayCopyMark {
  /**
   * Marks an object as a copy an array made.
   *
   * @param copy Copy owner.
   * @param mark Cell and signature of the copy.
   */
  static write(copy: THREE.Object3D, mark: EntityArrayCopyMarkData): void {
    copy.userData[ENTITY_ARRAY_COPY_USERDATA_KEY] = { cell: [...mark.cell], signature: mark.signature };
    entityPickDisabledSet(copy, true);
  }

  /**
   * Turns a copy into an ordinary object that can be clicked and edited.
   *
   * @param copy Copy owner.
   */
  static clear(copy: THREE.Object3D): void {
    delete copy.userData[ENTITY_ARRAY_COPY_USERDATA_KEY];
    entityPickDisabledSet(copy, false);
  }

  /**
   * Returns the mark of an object.
   *
   * @param object Candidate copy.
   * @returns Its mark, or null for objects no array made.
   */
  static read(object: THREE.Object3D): EntityArrayCopyMarkData | null {
    return EntityArrayCopyMark.fromUnknown(object.userData[ENTITY_ARRAY_COPY_USERDATA_KEY]);
  }

  /**
   * Returns whether an array made an object.
   *
   * @param object Candidate copy.
   * @returns True for array copies.
   */
  static is(object: THREE.Object3D): boolean {
    return EntityArrayCopyMark.read(object) !== null;
  }

  /**
   * Returns the copies an array made directly under its source.
   *
   * @param source Array source.
   * @returns Marked children in child order.
   */
  static copiesOf(source: THREE.Object3D): THREE.Object3D[] {
    return source.children.filter((child) => EntityArrayCopyMark.is(child));
  }

  /**
   * Reads untrusted data into a mark.
   *
   * @param value Any value, such as a scene file entry.
   * @returns The mark, or null when the value is not one.
   */
  static fromUnknown(value: unknown): EntityArrayCopyMarkData | null {
    if (typeof value !== 'object' || value === null) {
      return null;
    }
    const candidate = value as { cell?: unknown; signature?: unknown };
    const cell = candidate.cell;
    const isCell = Array.isArray(cell) && cell.length === 3 && cell.every((entry) => Number.isInteger(entry));
    if (!isCell || typeof candidate.signature !== 'string') {
      return null;
    }
    return { cell: [cell[0] as number, cell[1] as number, cell[2] as number], signature: candidate.signature };
  }
}
