import { describe, expect, it } from 'vitest';
import { VisGroupStore } from '@/visgroup/visgroup_store.js';
import { CommandVisGroupUserCreate } from '@/visgroup/commands/command_visgroup_user_create.js';

/** Unit tests for the undoable user VisGroup creation. */
describe('CommandVisGroupUserCreate', () => {
  it('adds the group on execute, removes it on undo and restores the same id on redo', () => {
    const store = new VisGroupStore();
    const command = new CommandVisGroupUserCreate(store, 'Walls');
    expect(store.userGroupFind(command.groupIdRead())).toBeNull();
    command.execute();
    expect(store.userGroupFind(command.groupIdRead())?.name).toBe('Walls');
    command.undo();
    expect(store.userGroupsList()).toEqual([]);
    command.execute();
    expect(store.userGroupsList().map((group) => group.id)).toEqual([command.groupIdRead()]);
  });

  it('gives every command its own id', () => {
    const store = new VisGroupStore();
    const first = new CommandVisGroupUserCreate(store, 'A');
    const second = new CommandVisGroupUserCreate(store, 'B');
    expect(first.groupIdRead()).not.toBe(second.groupIdRead());
  });
});
