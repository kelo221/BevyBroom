import type * as THREE from 'three';
import type { UndoCommand } from '@/commands/command_undo.js';
import { EntityOwnerRegistry } from '@/entity/registry/entity_owner_registry.js';
import { ObjectDataContributorRegistry } from '@/object_data/object_data_contributor_registry.js';

/** One duplicated entity with the source it is inserted after. */
interface EntityDuplicatePlacement {
  readonly clone: THREE.Group;
  readonly source: THREE.Object3D;
  readonly parent: THREE.Object3D;
}

/**
 * Undoable duplication of entity owners of any kind. Each copy keeps the source
 * transform, settings, visibility, parent and the data features store on it,
 * and is placed directly after its source. The same copies are reused across
 * undo and redo so their identifiers stay stable.
 */
export class CommandEntityDuplicate implements UndoCommand {
  private readonly placements: EntityDuplicatePlacement[];

  /**
   * Creates duplicates of the given owners without inserting them yet.
   *
   * @param sourceOwners Entity owners to duplicate; owners without a parent and
   *   objects that are not entity owners are skipped.
   */
  constructor(sourceOwners: readonly THREE.Object3D[]) {
    this.placements = [];
    for (const sourceOwner of sourceOwners) {
      this.placementAppend(sourceOwner);
    }
  }

  /**
   * Returns the duplicated owners.
   *
   * @returns The copies in source order.
   */
  getClonedOwners(): THREE.Group[] {
    return this.placements.map((placement) => placement.clone);
  }

  /** Inserts every copy after its source. */
  execute(): void {
    for (const placement of this.placements) {
      placement.parent.add(placement.clone);
      const sourceIndex = placement.parent.children.indexOf(placement.source);
      if (sourceIndex >= 0) {
        CommandEntityDuplicate.childMoveToIndex(placement.parent, placement.clone, sourceIndex + 1);
      }
    }
  }

  /** Removes every copy from its parent. */
  undo(): void {
    for (const placement of this.placements) {
      placement.clone.removeFromParent();
    }
  }

  /**
   * Builds the copy of one owner and records where it is inserted.
   *
   * @param sourceOwner Entity owner to duplicate.
   */
  private placementAppend(sourceOwner: THREE.Object3D): void {
    const parent = sourceOwner.parent;
    const entityOwner = EntityOwnerRegistry.find(sourceOwner);
    const settings = entityOwner?.settingsRead(sourceOwner) ?? null;
    if (parent === null || entityOwner === null || settings === null) {
      return;
    }
    const clone = entityOwner.create(sourceOwner.name, settings);
    clone.position.copy(sourceOwner.position);
    clone.quaternion.copy(sourceOwner.quaternion);
    clone.scale.copy(sourceOwner.scale);
    clone.visible = sourceOwner.visible;
    ObjectDataContributorRegistry.duplicateDataCopy(sourceOwner, clone);
    this.placements.push({ clone, source: sourceOwner, parent });
  }

  /**
   * Moves a child of a parent to a sibling index.
   *
   * @param parent Parent containing the child.
   * @param child Child to move.
   * @param targetIndex Desired sibling index, clamped to the valid range.
   */
  private static childMoveToIndex(parent: THREE.Object3D, child: THREE.Object3D, targetIndex: number): void {
    const currentIndex = parent.children.indexOf(child);
    if (currentIndex < 0) {
      return;
    }
    parent.children.splice(currentIndex, 1);
    const clampedIndex = Math.max(0, Math.min(targetIndex, parent.children.length));
    parent.children.splice(clampedIndex, 0, child);
  }
}
