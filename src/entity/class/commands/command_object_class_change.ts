import type * as THREE from 'three';
import type { UndoCommand } from '@/commands/command_undo.js';
import type { EntityClass } from '@/entity/class/entity_class.js';
import { type EntityClassObjectState, EntityClassObjectStateStore } from '@/entity/class/entity_class_object_state.js';
import { EntityClassRegistry } from '@/entity/class/registry/entity_class_registry.js';

/** One object with its class state before and after the change. */
interface CommandObjectClassChangeEntry {
  readonly object: THREE.Object3D;
  readonly before: EntityClassObjectState;
  readonly after: EntityClassObjectState;
}

/**
 * Undoable change of the class of scene objects, Hammer's Class dropdown. Each
 * object is converted in place: it leaves its current class and enters the new
 * one, so its identity, name, transform, parent, outliner place, layers,
 * VisGroups, comments and outputs stay. Undo restores every object's previous
 * class state.
 */
export class CommandObjectClassChange implements UndoCommand {
  private readonly entries: CommandObjectClassChangeEntry[];

  /**
   * Computes the new class state of every object the class fits.
   *
   * @param objects Objects to convert; objects the class does not fit are left
   *   alone.
   * @param targetClass Class the objects become.
   */
  constructor(objects: readonly THREE.Object3D[], targetClass: EntityClass) {
    this.entries = [];
    for (const object of objects) {
      this.entryAppend(object, targetClass);
    }
  }

  /**
   * Returns whether the command changes any object.
   *
   * @returns True when at least one object changes class state.
   */
  hasChanges(): boolean {
    return this.entries.length > 0;
  }

  /** Gives every object its new class state. */
  execute(): void {
    this.entries.forEach((entry) => EntityClassObjectStateStore.write(entry.object, entry.after));
  }

  /** Gives every object back its previous class state. */
  undo(): void {
    this.entries.forEach((entry) => EntityClassObjectStateStore.write(entry.object, entry.before));
  }

  /**
   * Records one object when the class fits it, is not its class already and
   * changes its state.
   *
   * @param object Scene object.
   * @param targetClass Class the object becomes.
   */
  private entryAppend(object: THREE.Object3D, targetClass: EntityClass): void {
    if (!targetClass.canApplyTo(object)) {
      return;
    }
    const previousClass = EntityClassRegistry.classOf(object);
    if (previousClass?.id === targetClass.id) {
      return;
    }
    const before = EntityClassObjectStateStore.capture(object);
    const withoutPreviousClass = previousClass ? previousClass.stateLeave(before) : before;
    const after = targetClass.stateEnter(withoutPreviousClass);
    if (!EntityClassObjectStateStore.equals(before, after)) {
      this.entries.push({ object, before, after });
    }
  }
}
