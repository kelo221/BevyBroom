import type { GameEntityClass, GameEntityField } from '@/game_entity/class/game_entity_class_schema.js';
import type { GameEntityComponents } from '@/game_entity/component/game_entity_component_store.js';
import type { PreviewFieldValue } from '@/preview/protocol/preview_protocol_placeable_types.js';

/**
 * Combines a class's defaults with an object's overrides into the values the
 * game will use.
 */
export class GameEntityComponentResolver {
  /**
   * Returns every field that holds a value, with the fields of groups in place
   * of the groups.
   *
   * @param fields Fields of a class or group.
   * @returns Value fields in display order.
   */
  static fieldsLeaf(fields: readonly GameEntityField[]): GameEntityField[] {
    return fields.flatMap((field) =>
      field.kind === 'group' ? GameEntityComponentResolver.fieldsLeaf(field.children ?? []) : [field],
    );
  }

  /**
   * Returns the field of a class at a path, searching groups too.
   *
   * @param gameClass Component class.
   * @param path Field path.
   * @returns The field, or null when the class has no such value field.
   */
  static fieldFind(gameClass: GameEntityClass, path: string): GameEntityField | null {
    return GameEntityComponentResolver.fieldsLeaf(gameClass.fields).find((field) => field.path === path) ?? null;
  }

  /**
   * Returns whether an object overrides a field.
   *
   * @param components Overrides of the object.
   * @param typePath Component type path.
   * @param path Field path.
   * @returns True when the field has an override.
   */
  static isOverridden(components: GameEntityComponents, typePath: string, path: string): boolean {
    const fields = components[typePath];
    return fields !== undefined && Object.prototype.hasOwnProperty.call(fields, path);
  }

  /**
   * Returns the value a field has on an object: its override, or the class
   * default.
   *
   * @param components Overrides of the object.
   * @param typePath Component type path.
   * @param field Field description.
   * @returns Effective value.
   */
  static valueEffective(components: GameEntityComponents, typePath: string, field: GameEntityField): PreviewFieldValue {
    const fields = components[typePath];
    if (fields && GameEntityComponentResolver.isOverridden(components, typePath, field.path)) {
      return fields[field.path] ?? field.default;
    }
    return field.default;
  }

  /**
   * Returns components with every field of a known class filled in: the
   * override where there is one, else the class default. Fields the class does
   * not list and components of unknown classes keep their overrides.
   *
   * @param components Component overrides by type path.
   * @param classFind Returns the class of a type path, or null when unknown.
   * @returns Effective components in the same type path order.
   */
  static componentsEffective(
    components: GameEntityComponents,
    classFind: (typePath: string) => GameEntityClass | null,
  ): GameEntityComponents {
    const effective: GameEntityComponents = {};
    for (const [typePath, overrides] of Object.entries(components)) {
      const gameClass = classFind(typePath);
      const fields = gameClass ? GameEntityComponentResolver.fieldsLeaf(gameClass.fields) : [];
      const resolved = Object.fromEntries(
        fields.map((field) => [field.path, GameEntityComponentResolver.valueEffective(components, typePath, field)]),
      );
      effective[typePath] = { ...overrides, ...resolved };
    }
    return effective;
  }
}
