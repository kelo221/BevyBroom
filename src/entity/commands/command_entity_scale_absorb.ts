import * as THREE from 'three';
import { CommandUndoBatch } from '@/commands/command_undo_batch.js';
import type { UndoCommand } from '@/commands/command_undo.js';
import {
  entityScaleAbsorbedSettingsRead,
  entityScaleAbsorberFind,
  entityScaleIsUnit,
} from '@/entity/scale/entity_scale_absorb.js';

/** One absorbing owner with the settings and scale it had before absorbing. */
interface EntityScaleAbsorbRecord {
  readonly owner: THREE.Object3D;
  readonly settingsBefore: object;
  readonly scaleBefore: THREE.Vector3;
}

/**
 * Undoable step that turns the current scale of absorbing owners into their
 * settings (a light's radius) and resets their scale to one. It reads the scale
 * when it runs, so it belongs right after the command that scaled them.
 */
export class CommandEntityScaleAbsorb implements UndoCommand {
  private readonly owners: readonly THREE.Object3D[];
  private records: EntityScaleAbsorbRecord[];

  /**
   * Creates the step for the given owners.
   *
   * @param owners Objects to absorb; objects that keep real scale are ignored.
   */
  constructor(owners: readonly THREE.Object3D[]) {
    this.owners = owners.filter((owner) => entityScaleAbsorberFind(owner) !== null);
    this.records = [];
  }

  /** Turns every owner's scale into settings and resets the scale to one. */
  execute(): void {
    this.records = [];
    for (const owner of this.owners) {
      this.ownerAbsorb(owner);
    }
  }

  /** Restores every owner's previous settings and scale. */
  undo(): void {
    for (const record of this.records) {
      entityScaleAbsorberFind(record.owner)?.settingsWrite(record.owner, record.settingsBefore);
      record.owner.scale.copy(record.scaleBefore);
    }
    this.records = [];
  }

  /**
   * Absorbs one owner whose scale is not one.
   *
   * @param owner Absorbing owner.
   */
  private ownerAbsorb(owner: THREE.Object3D): void {
    const entityOwner = entityScaleAbsorberFind(owner);
    const settingsBefore = entityOwner?.settingsRead(owner) ?? null;
    const settingsAfter = entityScaleAbsorbedSettingsRead(owner);
    if (!entityOwner || settingsBefore === null || settingsAfter === null || entityScaleIsUnit(owner)) {
      return;
    }
    this.records.push({ owner, settingsBefore, scaleBefore: owner.scale.clone() });
    entityOwner.settingsWrite(owner, settingsAfter);
    owner.scale.set(1, 1, 1);
  }
}

/**
 * Wraps a transform command so absorbing owners among its objects turn the
 * resulting scale into settings within the same undo step.
 *
 * @param command Transform command that may scale the objects.
 * @param objects Objects the command transforms.
 * @returns The command itself when no object absorbs scale, else a batch.
 */
export function entityScaleAbsorbCommandWrap(command: UndoCommand, objects: readonly THREE.Object3D[]): UndoCommand {
  const absorbers = objects.filter((object) => entityScaleAbsorberFind(object) !== null);
  if (absorbers.length === 0) {
    return command;
  }
  return new CommandUndoBatch([command, new CommandEntityScaleAbsorb(absorbers)]);
}
