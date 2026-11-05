import { CommandVisGroupMembership } from './command_visgroup_membership.js';

/**
 * Undoable removal of objects from a user VisGroup. Undo restores only the
 * memberships this command removed.
 */
export class CommandVisGroupMembershipRemove extends CommandVisGroupMembership {
  /**
   * Returns that this command takes the objects out of the group.
   *
   * @returns Always false.
   */
  protected membershipWantedRead(): boolean {
    return false;
  }
}
