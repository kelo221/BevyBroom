import type * as THREE from 'three';
import type { UndoCommand } from '@/commands/command_undo.js';
import type { ObjectPropertiesTabContext } from '@/ui/object_properties/registry/registry_object_properties_tab.js';
import { objectPropertiesTabCommandPush } from '@/ui/object_properties/tabs/object_properties_tab_section.js';
import type { ObjectPropertiesKeyvalueRawRow } from './object_properties_keyvalue_raw_row.js';

/**
 * Source of plain text keyvalues of the edited objects, such as their name or
 * the settings of their entity kind. Commits go through the dialog's command
 * stack.
 */
export abstract class ObjectPropertiesKeyvalueRawSource {
  protected readonly context: ObjectPropertiesTabContext;

  /**
   * Creates the source.
   *
   * @param context Tab context edits are pushed through.
   */
  constructor(context: ObjectPropertiesTabContext) {
    this.context = context;
  }

  /**
   * Returns the keyvalues the source has for the edited objects.
   *
   * @param objects Edited objects.
   * @returns Rows in display order; empty when the source does not apply.
   */
  abstract rowsCreate(objects: readonly THREE.Object3D[]): ObjectPropertiesKeyvalueRawRow[];

  /**
   * Pushes an edit when it changes anything.
   *
   * @param command Edit, or null when nothing would change.
   */
  protected commandPushIfAny(command: UndoCommand | null): void {
    if (command) {
      objectPropertiesTabCommandPush(this.context, command);
    }
  }
}
