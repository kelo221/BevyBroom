import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GameEntityLogicStore } from '@/game_entity/logic/game_entity_logic_store.js';
import { CommandObjectComments } from '@/ui/object_properties/commands/command_object_comments.js';

/**
 * The comments command writes one text onto every object and undo gives each
 * object back its own previous comments.
 */
describe('CommandObjectComments', () => {
  it('sets the comments of every object and restores each one on undo', () => {
    const first = new THREE.Group();
    const second = new THREE.Mesh();
    GameEntityLogicStore.commentsWrite(first, 'first note');
    const command = new CommandObjectComments([first, second], 'shared note');
    expect(command.hasChanges()).toBe(true);
    command.execute();
    expect(GameEntityLogicStore.commentsRead(first)).toBe('shared note');
    expect(GameEntityLogicStore.commentsRead(second)).toBe('shared note');
    command.undo();
    expect(GameEntityLogicStore.commentsRead(first)).toBe('first note');
    expect(GameEntityLogicStore.commentsRead(second)).toBe('');
  });

  it('reports no change when every object already has the comments', () => {
    const object = new THREE.Group();
    GameEntityLogicStore.commentsWrite(object, 'same');
    expect(new CommandObjectComments([object], 'same').hasChanges()).toBe(false);
  });
});
