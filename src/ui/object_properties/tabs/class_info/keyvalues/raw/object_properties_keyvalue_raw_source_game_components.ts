import type * as THREE from 'three';
import { CommandGameEntityComponentsSet } from '@/game_entity/commands/command_game_entity_components_set.js';
import { GameEntityClassRegistry } from '@/game_entity/class/game_entity_class_registry.js';
import type { GameEntityClass, GameEntityField } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityComponentResolver } from '@/game_entity/component/game_entity_component_resolver.js';
import {
  type GameEntityComponents,
  GameEntityComponentStore,
} from '@/game_entity/component/game_entity_component_store.js';
import { GameEntityComponentsEdit } from '@/game_entity/component/game_entity_components_edit.js';
import { GameEntityUiChrome } from '@/game_entity/ui/game_entity_ui_chrome.js';
import {
  type ObjectPropertiesKeyvalueRawRow,
  objectPropertiesKeyvalueTextFormat,
  objectPropertiesKeyvalueTextParse,
} from './object_properties_keyvalue_raw_row.js';
import { ObjectPropertiesKeyvalueRawSource } from './object_properties_keyvalue_raw_source.js';

/**
 * The fields of the game classes every edited object carries, one keyvalue per
 * visible value field, keyed by class and field path.
 */
export class ObjectPropertiesKeyvalueRawSourceGameComponents extends ObjectPropertiesKeyvalueRawSource {
  /**
   * Returns one row per visible field of every shared known class.
   *
   * @param objects Edited objects.
   * @returns Field rows in class and field order.
   */
  rowsCreate(objects: readonly THREE.Object3D[]): ObjectPropertiesKeyvalueRawRow[] {
    const componentsList = objects.map((object) => GameEntityComponentStore.read(object));
    return ObjectPropertiesKeyvalueRawSourceGameComponents.classesShared(componentsList).flatMap((gameClass) =>
      GameEntityComponentResolver.fieldsLeaf(gameClass.fields)
        .filter((field) => field.hidden !== true)
        .map((field) => this.rowCreate(objects, componentsList, gameClass, field)),
    );
  }

  /**
   * Builds the row of one field.
   *
   * @param objects Edited objects.
   * @param componentsList Overrides of every edited object.
   * @param gameClass Class of the field.
   * @param field Field description.
   * @returns Field row.
   */
  private rowCreate(
    objects: readonly THREE.Object3D[],
    componentsList: readonly GameEntityComponents[],
    gameClass: GameEntityClass,
    field: GameEntityField,
  ): ObjectPropertiesKeyvalueRawRow {
    return {
      key: `${gameClass.label}.${field.path}`,
      label: field.label,
      helpText: GameEntityUiChrome.fieldHelpText(field),
      valueTexts: componentsList.map((components) =>
        objectPropertiesKeyvalueTextFormat(
          GameEntityComponentResolver.valueEffective(components, gameClass.type_path, field),
        ),
      ),
      commit: (text) => this.fieldCommit(objects, gameClass.type_path, field, text),
    };
  }

  /**
   * Writes one typed field value onto every object as one edit.
   *
   * @param objects Edited objects.
   * @param typePath Component type path.
   * @param field Field description.
   * @param text Typed value.
   */
  private fieldCommit(
    objects: readonly THREE.Object3D[],
    typePath: string,
    field: GameEntityField,
    text: string,
  ): void {
    const value = objectPropertiesKeyvalueTextParse(text, field.default);
    const command = new CommandGameEntityComponentsSet(objects, (components) =>
      GameEntityComponentsEdit.fieldSet(components, typePath, field, value),
    );
    this.commandPushIfAny(command.hasChanges() ? command : null);
  }

  /**
   * Returns the known classes every object carries, sorted by type path.
   *
   * @param componentsList Overrides of every edited object.
   * @returns Shared classes.
   */
  private static classesShared(componentsList: readonly GameEntityComponents[]): GameEntityClass[] {
    const [first, ...others] = componentsList;
    const typePaths = Object.keys(first ?? {}).filter((typePath) =>
      others.every((components) => Object.hasOwn(components, typePath)),
    );
    return typePaths
      .sort()
      .map((typePath) => GameEntityClassRegistry.classFind(typePath))
      .filter((gameClass): gameClass is GameEntityClass => gameClass !== null);
  }
}
