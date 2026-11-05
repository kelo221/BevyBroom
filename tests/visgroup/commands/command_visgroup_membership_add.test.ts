import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { VisGroupStore } from '@/visgroup/visgroup_store.js';
import { CommandVisGroupMembershipAdd } from '@/visgroup/commands/command_visgroup_membership_add.js';

/** Unit tests for the undoable VisGroup membership assignment. */
describe('CommandVisGroupMembershipAdd', () => {
  it('assigns objects and undo removes only the memberships it added', () => {
    const store = new VisGroupStore();
    const group = store.userGroupCreate('Props');
    const alreadyMember = new THREE.Mesh();
    const newMember = new THREE.Mesh();
    store.objectGroupAdd(alreadyMember, group.id);
    const command = new CommandVisGroupMembershipAdd(store, [alreadyMember, newMember], group.id);
    command.execute();
    expect(store.objectGroupIdsRead(newMember)).toEqual([group.id]);
    command.undo();
    expect(store.objectGroupIdsRead(newMember)).toEqual([]);
    expect(store.objectGroupIdsRead(alreadyMember)).toEqual([group.id]);
    command.execute();
    expect(store.objectGroupIdsRead(newMember)).toEqual([group.id]);
  });
});
