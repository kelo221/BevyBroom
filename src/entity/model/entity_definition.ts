import type * as THREE from 'three';
import type { EntityKind } from '@/entity/model/entity_owner_keys.js';

/**
 * Rules of one entity kind: default, valid and parsed settings, and how its
 * editor-only visuals are drawn.
 */
export abstract class EntityDefinition<TSettings extends object> {
  /** Kind stored on owners of this definition. */
  abstract readonly kind: EntityKind;

  /**
   * Returns default settings for a new owner.
   *
   * @returns Fresh settings object.
   */
  abstract settingsCreateDefault(): TSettings;

  /**
   * Returns settings that satisfy every rule of this kind.
   *
   * @param settings Possibly invalid settings.
   * @returns Valid settings.
   */
  abstract settingsSanitize(settings: TSettings): TSettings;

  /**
   * Reads untrusted data into valid settings.
   *
   * @param value Any value.
   * @returns Valid settings, or null when the value is not an object.
   */
  abstract settingsFromUnknown(value: unknown): TSettings | null;

  /**
   * Rebuilds the owner's editor-only visuals for the settings.
   *
   * @param owner Entity owner group.
   * @param settings Valid settings.
   */
  abstract visualsRefresh(owner: THREE.Object3D, settings: TSettings): void;

  /**
   * Copies settings so later edits do not alias the source.
   *
   * @param settings Source settings.
   * @returns Independent deep copy.
   */
  settingsClone(settings: TSettings): TSettings {
    return structuredClone(settings);
  }
}
