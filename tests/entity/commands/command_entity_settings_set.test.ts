import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { CommandEntitySettingsSet } from '@/entity/commands/command_entity_settings_set.js';
import { LightOwner } from '@/light/model/light_owner.js';

/**
 * Light setting edits are single history entries that restore each light
 * exactly.
 */
describe('CommandEntitySettingsSet', () => {
  it('applies one edit to several lights and undoes each to its own previous value', () => {
    const first = LightOwner.createDefault('First', 'point');
    const second = LightOwner.createDefault('Second', 'spot');
    const firstRadius = LightOwner.settingsRead(first)?.radius ?? 0;
    const secondRadius = LightOwner.settingsRead(second)?.radius ?? 0;
    const stack = new CommandStack(8);
    stack.push(new CommandEntitySettingsSet(LightOwner, [first, second], (settings) => ({ ...settings, radius: 12 })));
    expect(LightOwner.settingsRead(first)?.radius).toBe(12);
    expect(LightOwner.settingsRead(second)?.radius).toBe(12);
    stack.undo();
    expect(LightOwner.settingsRead(first)?.radius).toBe(firstRadius);
    expect(LightOwner.settingsRead(second)?.radius).toBe(secondRadius);
    stack.redo();
    expect(LightOwner.settingsRead(second)?.radius).toBe(12);
  });

  it('ignores objects that are not lights', () => {
    const command = new CommandEntitySettingsSet(LightOwner, [new THREE.Group()], (settings) => settings);
    expect(command.hasChanges()).toBe(false);
  });
});
