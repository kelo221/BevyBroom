import type * as THREE from 'three';
import { CommandEntitySettingsSet } from '@/entity/commands/command_entity_settings_set.js';
import type { EntityOwner } from '@/entity/model/entity_owner.js';
import { EntityOwnerRegistry } from '@/entity/registry/entity_owner_registry.js';
import { objectPropertiesKeyvalueEntitySettingCaptionLookup } from './object_properties_keyvalue_entity_setting_caption.js';
import {
  type ObjectPropertiesKeyvalueRawRow,
  objectPropertiesKeyvalueTextFormat,
  objectPropertiesKeyvalueTextParse,
} from './object_properties_keyvalue_raw_row.js';
import { ObjectPropertiesKeyvalueRawSource } from './object_properties_keyvalue_raw_source.js';

/**
 * The settings of the edited objects' entity kind, such as a light's radius,
 * one keyvalue per setting. It applies when every edited object is an owner of
 * the same kind.
 */
export class ObjectPropertiesKeyvalueRawSourceEntitySettings extends ObjectPropertiesKeyvalueRawSource {
  /**
   * Returns one row per setting of the first object's kind.
   *
   * @param objects Edited objects.
   * @returns Setting rows; empty when the objects are not all of one kind.
   */
  rowsCreate(objects: readonly THREE.Object3D[]): ObjectPropertiesKeyvalueRawRow[] {
    const entityOwner = ObjectPropertiesKeyvalueRawSourceEntitySettings.sharedOwnerFind(objects);
    if (!entityOwner) {
      return [];
    }
    const settingsList = objects.map((object) => entityOwner.settingsRead(object) ?? {});
    const firstSettings = settingsList[0] ?? {};
    return Object.keys(firstSettings).map((key) =>
      this.rowCreate(entityOwner, objects, key, settingsList, firstSettings),
    );
  }

  /**
   * Builds the row of one settings key.
   *
   * @param entityOwner Owner helper of the kind.
   * @param objects Edited owners.
   * @param key Setting key.
   * @param settingsList Settings of every edited owner.
   * @param firstSettings Settings of the first owner.
   * @returns Setting row.
   */
  private rowCreate(
    entityOwner: EntityOwner<object>,
    objects: readonly THREE.Object3D[],
    key: string,
    settingsList: readonly object[],
    firstSettings: object,
  ): ObjectPropertiesKeyvalueRawRow {
    const caption = objectPropertiesKeyvalueEntitySettingCaptionLookup(entityOwner.kind, key);
    return {
      key,
      label: caption.label,
      helpText: caption.helpText,
      valueTexts: this.settingValueTextsRead(settingsList, key),
      commit: (text) => this.settingTextCommit(entityOwner, objects, key, firstSettings, text),
    };
  }

  /**
   * Formats one setting of every owner as keyvalue text.
   *
   * @param settingsList Settings of every edited owner.
   * @param key Setting key.
   * @returns Value text of every owner.
   */
  private settingValueTextsRead(settingsList: readonly object[], key: string): string[] {
    return settingsList.map((settings) => objectPropertiesKeyvalueTextFormat(Reflect.get(settings, key)));
  }

  /**
   * Parses typed text and writes it as one setting of every owner.
   *
   * @param entityOwner Owner helper of the kind.
   * @param objects Edited owners.
   * @param key Setting key.
   * @param firstSettings Settings of the first owner.
   * @param text Typed value.
   */
  private settingTextCommit(
    entityOwner: EntityOwner<object>,
    objects: readonly THREE.Object3D[],
    key: string,
    firstSettings: object,
    text: string,
  ): void {
    this.settingCommit(
      entityOwner,
      objects,
      key,
      objectPropertiesKeyvalueTextParse(text, Reflect.get(firstSettings, key)),
    );
  }

  /**
   * Writes one setting onto every owner as one edit; values the kind rejects
   * are replaced by valid ones.
   *
   * @param entityOwner Owner helper of the kind.
   * @param objects Edited owners.
   * @param key Setting key.
   * @param value Parsed typed value.
   */
  private settingCommit(
    entityOwner: EntityOwner<object>,
    objects: readonly THREE.Object3D[],
    key: string,
    value: unknown,
  ): void {
    const definition = entityOwner.definition;
    const patch = { [key]: value };
    const command = new CommandEntitySettingsSet(
      entityOwner,
      objects,
      (settings) => definition.settingsFromUnknown(definition.settingsPatch(settings, patch)) ?? settings,
    );
    this.commandPushIfAny(command.hasChanges() ? command : null);
  }

  /**
   * Returns the owner helper every object is an owner of.
   *
   * @param objects Edited objects.
   * @returns Shared owner helper, or null.
   */
  private static sharedOwnerFind(objects: readonly THREE.Object3D[]): EntityOwner<object> | null {
    const [first] = objects;
    const entityOwner = first ? EntityOwnerRegistry.find(first) : null;
    return entityOwner && objects.every((object) => entityOwner.isOwner(object)) ? entityOwner : null;
  }
}
