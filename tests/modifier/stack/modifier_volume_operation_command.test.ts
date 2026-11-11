import type * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ModifierVolume } from '@/modifier/stack/modifier_volume.js';
import {
  modifierVolumeOperationCommand,
  modifierVolumeOperationCommands,
  modifierVolumeOperationToggleCommands,
  modifierVolumeSolidOperationRead,
} from '@/modifier/stack/modifier_volume_operation_command.js';
import type { ModifierStackVolumeOperation } from '@/modifier/stack/modifier_stack_types.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';
import { stackFixture } from './modifier_stack_fixture.js';

/**
 * Stores a volume operation directly, without an undo entry.
 *
 * @param volume Modifier volume.
 * @param operation Volume operation to store.
 */
function volumeOperationStore(volume: THREE.Object3D, operation: ModifierStackVolumeOperation): void {
  ModifierVolume.write(volume, { ...ModifierVolume.read(volume), operation });
}

describe('modifier volume operation command', () => {
  it('reads a volume without a boolean operation as additive', () => {
    const fixture = stackFixture(['linear']);
    expect(modifierVolumeSolidOperationRead(fixture.volume)).toBe(SolidOperation.Additive);
  });

  it('reads each stored boolean operation as its solid CSG operation', () => {
    const fixture = stackFixture(['linear']);
    volumeOperationStore(fixture.volume, 'subtract');
    expect(modifierVolumeSolidOperationRead(fixture.volume)).toBe(SolidOperation.Subtractive);
    volumeOperationStore(fixture.volume, 'intersect');
    expect(modifierVolumeSolidOperationRead(fixture.volume)).toBe(SolidOperation.Intersecting);
  });

  it('stores a new operation and undoes back to the previous one', () => {
    const fixture = stackFixture(['linear']);
    const command = modifierVolumeOperationCommand(fixture.volume, SolidOperation.Subtractive);
    expect(command).not.toBeNull();
    command?.execute();
    expect(ModifierVolume.read(fixture.volume).operation).toBe('subtract');
    command?.undo();
    expect(ModifierVolume.read(fixture.volume).operation).toBe('none');
  });

  it('returns no command when the volume already has the operation', () => {
    const fixture = stackFixture(['linear']);
    volumeOperationStore(fixture.volume, 'add');
    expect(modifierVolumeOperationCommand(fixture.volume, SolidOperation.Additive)).toBeNull();
  });

  it('applies one operation to every volume and skips the ones that already match', () => {
    const first = stackFixture(['linear']);
    const second = stackFixture(['linear']);
    volumeOperationStore(second.volume, 'subtract');
    const commands = modifierVolumeOperationCommands([first.volume, second.volume], SolidOperation.Subtractive);
    expect(commands).toHaveLength(1);
    for (const command of commands) command.execute();
    expect(ModifierVolume.read(first.volume).operation).toBe('subtract');
    expect(ModifierVolume.read(second.volume).operation).toBe('subtract');
  });

  it('flips additive and subtractive volumes and leaves intersecting volumes alone', () => {
    const additive = stackFixture(['linear']);
    const subtractive = stackFixture(['linear']);
    const intersecting = stackFixture(['linear']);
    volumeOperationStore(subtractive.volume, 'subtract');
    volumeOperationStore(intersecting.volume, 'intersect');
    const commands = modifierVolumeOperationToggleCommands([additive.volume, subtractive.volume, intersecting.volume]);
    expect(commands).toHaveLength(2);
    for (const command of commands) command.execute();
    expect(ModifierVolume.read(additive.volume).operation).toBe('subtract');
    expect(ModifierVolume.read(subtractive.volume).operation).toBe('add');
    expect(ModifierVolume.read(intersecting.volume).operation).toBe('intersect');
  });
});
