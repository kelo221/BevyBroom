import type { VisGroupStore } from '../visgroup_store.js';
import type { UserVisGroup } from '../visgroup_types.js';
import { CommandVisGroup } from './command_visgroup.js';

/**
 * Undoable creation of one user VisGroup. Redo restores the group under the
 * same id so memberships recorded against it stay valid.
 */
export class CommandVisGroupUserCreate extends CommandVisGroup {
  private readonly group: UserVisGroup;

  /**
   * Creates the command for a new user VisGroup with a fresh id.
   *
   * @param store VisGroup store receiving the group.
   * @param name Display name of the group.
   */
  constructor(store: VisGroupStore, name: string) {
    super(store);
    this.group = store.userGroupDescribe(name);
  }

  /**
   * Returns the id of the group this command creates.
   *
   * @returns User VisGroup id.
   */
  groupIdRead(): string {
    return this.group.id;
  }

  /** Adds the user VisGroup to the store. */
  execute(): void {
    this.store.userGroupInsert(this.group);
  }

  /** Removes the user VisGroup from the store. */
  undo(): void {
    this.store.userGroupDelete(this.group.id);
  }
}
