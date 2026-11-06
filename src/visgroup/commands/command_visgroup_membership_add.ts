import { CommandVisGroupMembership } from './command_visgroup_membership.js';

/**
 * Undoable assignment of objects to a user VisGroup. Undo removes only the
 * memberships this command added, so earlier memberships stay.
 */
export class CommandVisGroupMembershipAdd extends CommandVisGroupMembership {
  /**
   * Returns that this command makes the objects members.
   *
   * @returns Always true.
   */
  protected membershipWantedRead(): boolean {
    return true;
  }
}
