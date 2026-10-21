import type { GameEntityField } from '@/game_entity/class/game_entity_class_schema.js';
import type { GameEntityComponents } from '@/game_entity/component/game_entity_component_store.js';
import {
  gameEntityFieldValueEquals,
  gameEntityFieldValueNormalize,
} from '@/game_entity/component/game_entity_component_value.js';

/**
 * Pure edits of component overrides. Each returns new overrides and leaves its
 * input untouched, so commands can compute before and after states.
 */
export class GameEntityComponentsEdit {
  /**
   * Attaches a component with no overrides; attached components are kept.
   *
   * @param components Current overrides.
   * @param typePath Component type path.
   * @returns Overrides with the component attached.
   */
  static componentAdd(components: GameEntityComponents, typePath: string): GameEntityComponents {
    if (components[typePath]) {
      return structuredClone(components);
    }
    return { ...structuredClone(components), [typePath]: {} };
  }

  /**
   * Detaches a component and drops its overrides.
   *
   * @param components Current overrides.
   * @param typePath Component type path.
   * @returns Overrides without the component.
   */
  static componentRemove(components: GameEntityComponents, typePath: string): GameEntityComponents {
    const next = structuredClone(components);
    delete next[typePath];
    return next;
  }

  /**
   * Sets one field of an attached component. A value equal to the default
   * removes the override, so only real changes are stored; a value that does
   * not fit the field changes nothing.
   *
   * @param components Current overrides.
   * @param typePath Component type path.
   * @param field Field description.
   * @param value New value.
   * @returns Overrides with the field set.
   */
  static fieldSet(
    components: GameEntityComponents,
    typePath: string,
    field: GameEntityField,
    value: unknown,
  ): GameEntityComponents {
    const normalized = gameEntityFieldValueNormalize(field, value);
    if (normalized === undefined) {
      return structuredClone(components);
    }
    if (gameEntityFieldValueEquals(normalized, field.default)) {
      return GameEntityComponentsEdit.fieldReset(components, typePath, field.path);
    }
    const next = GameEntityComponentsEdit.componentAdd(components, typePath);
    next[typePath] = { ...next[typePath], [field.path]: normalized };
    return next;
  }

  /**
   * Removes the override of one field so it uses the class default again.
   *
   * @param components Current overrides.
   * @param typePath Component type path.
   * @param path Field path.
   * @returns Overrides without that field's override.
   */
  static fieldReset(components: GameEntityComponents, typePath: string, path: string): GameEntityComponents {
    const next = structuredClone(components);
    const fields = next[typePath];
    if (fields) {
      delete fields[path];
    }
    return next;
  }
}
