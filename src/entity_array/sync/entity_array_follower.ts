import type * as THREE from 'three';
import type { CommandStack } from '@/commands/command_stack.js';
import type { UndoCommand } from '@/commands/command_undo.js';
import { EntityArrayCopyBuilder } from '@/entity_array/build/entity_array_copy_builder.js';
import { EntityArraySignature } from '@/entity_array/build/entity_array_signature.js';
import { EntityArrayFootprint } from '@/entity_array/layout/entity_array_footprint.js';
import { EntityArrayLayout } from '@/entity_array/layout/entity_array_layout.js';
import { EntityArrayCopyMark } from '@/entity_array/model/entity_array_copy_mark.js';
import { EntityArrayStore } from '@/entity_array/model/entity_array_store.js';
import {
  CommandEntityArrayCopiesSync,
  type EntityArrayCopiesChange,
} from '@/entity_array/sync/command_entity_array_copies_sync.js';

/**
 * Keeps the copies of every array in step with its source and settings, as
 * part of every recorded edit: an array whose copies were built from other
 * content, settings or footprint gets new copies, and the copies of an entity
 * that stopped repeating go.
 */
export class EntityArrayFollower {
  private readonly worldObject: THREE.Object3D;

  /**
   * Creates the follower.
   *
   * @param worldObject Scene root holding the arrays.
   */
  constructor(worldObject: THREE.Object3D) {
    this.worldObject = worldObject;
  }

  /**
   * Makes every recorded edit of a command stack bring the arrays in step.
   *
   * @param commandStack Stack whose recorded edits are followed.
   * @returns Function that stops following.
   */
  follow(commandStack: CommandStack): () => void {
    return commandStack.followUpProviderAdd(() => this.syncCommandCreate());
  }

  /**
   * Returns the command that brings every array in step, without running it.
   *
   * @returns Command, or null when every array already matches.
   */
  syncCommandCreate(): UndoCommand | null {
    const changes = this.sourcesCollect().flatMap((source) => EntityArrayFollower.sourceChangesOf(source));
    return changes.length === 0 ? null : new CommandEntityArrayCopiesSync(changes);
  }

  /**
   * Returns every object that repeats or still holds copies from when it did.
   *
   * @returns Sources in traversal order, each once.
   */
  private sourcesCollect(): THREE.Object3D[] {
    const sources = new Set<THREE.Object3D>(EntityArrayStore.sourcesUnder(this.worldObject));
    this.worldObject.traverse((object) => {
      if (object.parent !== null && EntityArrayCopyMark.is(object)) {
        sources.add(object.parent);
      }
    });
    return [...sources];
  }

  /**
   * Returns the change one source needs.
   *
   * @param source Array source, or a former one still holding copies.
   * @returns One change replacing out-of-date copies, or none when they match.
   */
  private static sourceChangesOf(source: THREE.Object3D): EntityArrayCopiesChange[] {
    const existing = EntityArrayCopyMark.copiesOf(source);
    const settings = EntityArrayStore.read(source);
    if (settings === null) {
      return existing.length === 0 ? [] : [{ source, removed: existing, added: [] }];
    }
    const footprintSize = EntityArrayFootprint.sizeOf(source);
    const cells = EntityArrayLayout.cellsOf(settings, footprintSize);
    const signature = EntityArraySignature.of(source, settings, footprintSize);
    if (EntityArrayFollower.copiesMatch(existing, cells.length, signature)) {
      return [];
    }
    const added = EntityArrayCopyBuilder.copiesCreate(source, cells, signature);
    return [{ source, removed: existing, added }];
  }

  /**
   * Returns whether existing copies were built for the current signature and
   * fill every cell.
   *
   * @param copies Existing copies.
   * @param cellCount Number of cells to fill.
   * @param signature Current signature.
   * @returns True when nothing needs rebuilding.
   */
  private static copiesMatch(copies: readonly THREE.Object3D[], cellCount: number, signature: string): boolean {
    return (
      copies.length === cellCount && copies.every((copy) => EntityArrayCopyMark.read(copy)?.signature === signature)
    );
  }
}
