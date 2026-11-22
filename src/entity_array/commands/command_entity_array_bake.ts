import * as THREE from 'three';
import type { UndoCommand } from '@/commands/command_undo.js';
import { EntityArrayCopyMark, type EntityArrayCopyMarkData } from '@/entity_array/model/entity_array_copy_mark.js';
import type { EntityArraySettings } from '@/entity_array/model/entity_array_settings.js';
import { EntityArrayStore } from '@/entity_array/model/entity_array_store.js';

/** One copy as it stood under its source before the bake. */
interface EntityArrayBakedCopy {
  readonly copy: THREE.Object3D;
  readonly mark: EntityArrayCopyMarkData;
  readonly localMatrix: THREE.Matrix4;
}

/** One array source with its settings and copies before the bake. */
interface EntityArrayBakedSource {
  readonly source: THREE.Object3D;
  readonly parent: THREE.Object3D;
  readonly settings: EntityArraySettings;
  readonly copies: readonly EntityArrayBakedCopy[];
}

/**
 * Undoable bake of arrays into ordinary objects: each source stops repeating
 * and its copies become ordinary entities beside it, keeping where they stand
 * in the world, so each one can be edited on its own.
 */
export class CommandEntityArrayBake implements UndoCommand {
  private readonly sources: readonly EntityArrayBakedSource[];

  /**
   * Records the arrays to bake.
   *
   * @param owners Candidate entity owners; those that do not repeat or have no
   *   parent are skipped.
   */
  constructor(owners: readonly THREE.Object3D[]) {
    this.sources = owners.flatMap((owner) => CommandEntityArrayBake.sourceRecord(owner));
  }

  /**
   * Returns whether the command bakes any array.
   *
   * @returns True when at least one owner repeats.
   */
  hasChanges(): boolean {
    return this.sources.length > 0;
  }

  /** Turns every copy into an ordinary entity beside its source. */
  execute(): void {
    this.sources.forEach((baked) => {
      EntityArrayStore.write(baked.source, null);
      baked.copies.forEach((entry) => {
        EntityArrayCopyMark.clear(entry.copy);
        baked.parent.attach(entry.copy);
      });
    });
  }

  /** Puts every copy back under its source and makes the source repeat again. */
  undo(): void {
    this.sources.forEach((baked) => {
      baked.copies.forEach((entry) => {
        baked.source.add(entry.copy);
        entry.localMatrix.decompose(entry.copy.position, entry.copy.quaternion, entry.copy.scale);
        EntityArrayCopyMark.write(entry.copy, entry.mark);
      });
      EntityArrayStore.write(baked.source, baked.settings);
    });
  }

  /**
   * Records one array before the bake.
   *
   * @param owner Candidate entity owner.
   * @returns The record, or nothing when the owner does not repeat or has no
   *   parent.
   */
  private static sourceRecord(owner: THREE.Object3D): EntityArrayBakedSource[] {
    const settings = EntityArrayStore.read(owner);
    const parent = owner.parent;
    if (settings === null || parent === null) {
      return [];
    }
    const copies = EntityArrayCopyMark.copiesOf(owner).flatMap((copy) => {
      const mark = EntityArrayCopyMark.read(copy);
      const localMatrix = new THREE.Matrix4().compose(copy.position, copy.quaternion, copy.scale);
      return mark === null ? [] : [{ copy, mark, localMatrix }];
    });
    return [{ source: owner, parent, settings, copies }];
  }
}
