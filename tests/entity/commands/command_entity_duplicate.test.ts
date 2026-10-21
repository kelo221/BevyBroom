import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { CommandEntityDuplicate } from '@/entity/commands/command_entity_duplicate.js';
import { LightOwner } from '@/light/model/light_owner.js';
import { lightSettingsCreateDefault } from '@/light/model/light_settings.js';

/**
 * Duplicating entities copies placement and settings and keeps the copy's
 * identity across redo.
 */
describe('CommandEntityDuplicate', () => {
  it('inserts a copy right after the source with the same transform and settings', () => {
    const parent = new THREE.Group();
    const source = LightOwner.create('Lamp', { ...lightSettingsCreateDefault('spot'), radius: 6.5 });
    source.position.set(2, 3, -4);
    source.rotation.set(0.3, -0.7, 0.1);
    const sibling = new THREE.Group();
    parent.add(source, sibling);
    const command = new CommandEntityDuplicate([source]);
    new CommandStack(4).push(command);
    const [clone] = command.getClonedOwners();
    expect(clone).toBeDefined();
    if (!clone) return;
    expect(parent.children.indexOf(clone)).toBe(parent.children.indexOf(source) + 1);
    expect(clone.position.distanceTo(source.position)).toBeLessThan(1e-6);
    expect(clone.quaternion.angleTo(source.quaternion)).toBeLessThan(1e-6);
    expect(LightOwner.settingsRead(clone)).toEqual(LightOwner.settingsRead(source));
    expect(clone.uuid).not.toBe(source.uuid);
  });

  it('removes the copy on undo and restores the same object on redo', () => {
    const parent = new THREE.Group();
    const source = LightOwner.createDefault('Lamp', 'point');
    parent.add(source);
    const stack = new CommandStack(4);
    const command = new CommandEntityDuplicate([source]);
    stack.push(command);
    const [clone] = command.getClonedOwners();
    stack.undo();
    expect(clone?.parent).toBeNull();
    stack.redo();
    expect(clone?.parent).toBe(parent);
    expect(parent.children.filter((child) => child === clone)).toHaveLength(1);
  });
});
