import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { VisGroupStore } from '@/visgroup/visgroup_store.js';
import { CommandVisGroupMembershipRemove } from '@/visgroup/commands/command_visgroup_membership_remove.js';

/**
 * Removing objects from a VisGroup only touches members, and undo gives back
 * exactly the memberships it took away.
 */
describe('CommandVisGroupMembershipRemove', () => {
  it('removes members and restores only them on undo', () => {
    const store = new VisGroupStore();
    const group = store.userGroupCreate('Doors');
    const member = new THREE.Mesh();
    const outsider = new THREE.Mesh();
    store.objectGroupAdd(member, group.id);
    const command = new CommandVisGroupMembershipRemove(store, [member, outsider], group.id);
    command.execute();
    expect(store.objectGroupIdsRead(member)).not.toContain(group.id);
    command.undo();
    expect(store.objectGroupIdsRead(member)).toContain(group.id);
    expect(store.objectGroupIdsRead(outsider)).not.toContain(group.id);
  });
});
