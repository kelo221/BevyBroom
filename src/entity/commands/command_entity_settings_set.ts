import type * as THREE from 'three';
import type { UndoCommand } from '@/commands/command_undo.js';
import type { EntityOwner } from '@/entity/model/entity_owner.js';

/** One owner with its settings before and after the edit. */
interface EntitySettingsChange<TSettings extends object> {
  readonly owner: THREE.Object3D;
  readonly before: TSettings;
  readonly after: TSettings;
}

/**
 * Undoable change of the settings of one or more entities of one kind. Each
 * owner keeps its own before and after state, so multi-selection edits restore
 * exactly.
 */
export class CommandEntitySettingsSet<TSettings extends object> implements UndoCommand {
  private readonly entityOwner: EntityOwner<TSettings>;
  private readonly changes: EntitySettingsChange<TSettings>[];

  /**
   * Captures current settings and computes new ones per owner.
   *
   * @param entityOwner Owner helper of the edited kind.
   * @param owners Owners to edit; objects of other kinds are ignored.
   * @param edit Produces the new settings from an owner's current settings.
   */
  constructor(
    entityOwner: EntityOwner<TSettings>,
    owners: readonly THREE.Object3D[],
    edit: (current: TSettings) => TSettings,
  ) {
    this.entityOwner = entityOwner;
    this.changes = [];
    for (const owner of owners) {
      this.changeAppend(owner, edit);
    }
  }

  /**
   * Returns whether the command touches any owner.
   *
   * @returns True when at least one owner is edited.
   */
  hasChanges(): boolean {
    return this.changes.length > 0;
  }

  /** Applies the new settings to every owner. */
  execute(): void {
    for (const change of this.changes) {
      this.entityOwner.settingsWrite(change.owner, change.after);
    }
  }

  /** Restores every owner's previous settings. */
  undo(): void {
    for (const change of this.changes) {
      this.entityOwner.settingsWrite(change.owner, change.before);
    }
  }

  /**
   * Records the before and after settings of one owner.
   *
   * @param owner Candidate owner.
   * @param edit Produces the new settings from the current settings.
   */
  private changeAppend(owner: THREE.Object3D, edit: (current: TSettings) => TSettings): void {
    const before = this.entityOwner.settingsRead(owner);
    if (!before) {
      return;
    }
    const definition = this.entityOwner.definition;
    const after = definition.settingsClone(edit(definition.settingsClone(before)));
    this.changes.push({ owner, before, after });
  }
}
