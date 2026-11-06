import type * as THREE from 'three';
import { CommandUndoBatch } from '@/commands/command_undo_batch.js';
import { CommandObjectRename } from '@/outliner/commands/command_object_rename.js';
import { filterUnlockedObjects } from '@/utils/object_lock.js';
import type { ObjectPropertiesKeyvalueRawRow } from './object_properties_keyvalue_raw_row.js';
import { ObjectPropertiesKeyvalueRawSource } from './object_properties_keyvalue_raw_source.js';

/**
 * The name keyvalue (Hammer's targetname). Renaming goes through the rename
 * command, so entity I/O targets that named the old name follow the new one.
 */
export class ObjectPropertiesKeyvalueRawSourceName extends ObjectPropertiesKeyvalueRawSource {
  /**
   * Returns the name row.
   *
   * @param objects Edited objects.
   * @returns One row with every object's name.
   */
  rowsCreate(objects: readonly THREE.Object3D[]): ObjectPropertiesKeyvalueRawRow[] {
    return [
      {
        key: 'targetname',
        label: 'Name',
        helpText: 'The name outputs of other entities target this object by.',
        valueTexts: objects.map((object) => object.name),
        commit: (text) => this.nameCommit(objects, text),
      },
    ];
  }

  /**
   * Renames every unlocked object whose name differs as one edit; blank names
   * are ignored.
   *
   * @param objects Edited objects.
   * @param text Typed name.
   */
  private nameCommit(objects: readonly THREE.Object3D[], text: string): void {
    const nameNext = text.trim();
    const renamed = filterUnlockedObjects(objects).filter((object) => object.name !== nameNext);
    if (nameNext === '' || renamed.length === 0) {
      return;
    }
    this.commandPushIfAny(new CommandUndoBatch(renamed.map((object) => new CommandObjectRename(object, nameNext))));
  }
}
