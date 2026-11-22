import type * as THREE from 'three';
import type { UndoCommand } from '@/commands/command_undo.js';
import type { EntityArraySettings } from '@/entity_array/model/entity_array_settings.js';
import { EntityArrayStore } from '@/entity_array/model/entity_array_store.js';

/** Array settings of one entity before and after an edit. */
interface EntityArraySetChange {
  readonly owner: THREE.Object3D;
  readonly before: EntityArraySettings | null;
  readonly after: EntityArraySettings | null;
}

/**
 * Undoable change of the array settings of entities: makes them repeat, edits
 * how, or stops them repeating. The copies follow when the command is
 * recorded.
 */
export class CommandEntityArraySet implements UndoCommand {
  private readonly changes: readonly EntityArraySetChange[];

  /**
   * Creates the command from the entities' current settings.
   *
   * @param owners Entity owners to change.
   * @param settingsOf Turns an owner's current settings into its new ones; null
   *   stops it repeating.
   */
  constructor(
    owners: readonly THREE.Object3D[],
    settingsOf: (current: EntityArraySettings | null) => EntityArraySettings | null,
  ) {
    this.changes = owners.map((owner) => {
      const before = EntityArrayStore.read(owner);
      return { owner, before, after: settingsOf(before) };
    });
  }

  /**
   * Returns whether the command changes any entity.
   *
   * @returns True when at least one entity gets other settings.
   */
  hasChanges(): boolean {
    return this.changes.some((change) => JSON.stringify(change.before) !== JSON.stringify(change.after));
  }

  /** Writes the new settings. */
  execute(): void {
    this.changes.forEach((change) => EntityArrayStore.write(change.owner, change.after));
  }

  /** Writes the old settings back. */
  undo(): void {
    this.changes.forEach((change) => EntityArrayStore.write(change.owner, change.before));
  }
}
