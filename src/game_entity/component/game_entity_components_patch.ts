import { GameEntityClassRegistry } from '@/game_entity/class/game_entity_class_registry.js';
import type { GameEntityClass } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityComponentResolver } from '@/game_entity/component/game_entity_component_resolver.js';
import type { GameEntityComponents } from '@/game_entity/component/game_entity_component_store.js';
import { gameEntityFieldValueNormalize } from '@/game_entity/component/game_entity_component_value.js';
import { GameEntityComponentsEdit } from '@/game_entity/component/game_entity_components_edit.js';

/**
 * Changes to component overrides: component type path to the field values to
 * set, or null to remove the component. Listed components are attached when
 * missing; unlisted ones stay as they are.
 */
export type GameEntityComponentsPatch = Record<string, Record<string, unknown> | null>;

/** Overrides after a patch, and every part of the patch that did not apply. */
export interface GameEntityComponentsPatchResult {
  components: GameEntityComponents;
  errors: string[];
}

/**
 * Applies a patch to component overrides. Values are checked against the
 * classes the editor knows; unknown classes, unknown fields and values that do
 * not fit their field are reported and skipped.
 *
 * @param components Current overrides.
 * @param patch Changes to apply.
 * @returns New overrides and the errors.
 */
export function gameEntityComponentsPatchApply(
  components: GameEntityComponents,
  patch: GameEntityComponentsPatch,
): GameEntityComponentsPatchResult {
  const result: GameEntityComponentsPatchResult = { components: structuredClone(components), errors: [] };
  for (const [typePath, fields] of Object.entries(patch)) {
    if (fields === null) {
      result.components = GameEntityComponentsEdit.componentRemove(result.components, typePath);
      continue;
    }
    const gameClass = GameEntityClassRegistry.classFind(typePath);
    if (!gameClass) {
      result.errors.push(`${typePath} is not a game component class`);
      continue;
    }
    result.components = GameEntityComponentsEdit.componentAdd(result.components, typePath);
    gameEntityComponentFieldsApply(result, gameClass, fields);
  }
  return result;
}

/**
 * Sets the fields of one attached component, recording values that do not
 * apply.
 *
 * @param result Patch result updated in place.
 * @param gameClass Class of the component.
 * @param fields Field path to value.
 */
function gameEntityComponentFieldsApply(
  result: GameEntityComponentsPatchResult,
  gameClass: GameEntityClass,
  fields: Record<string, unknown>,
): void {
  for (const [path, value] of Object.entries(fields)) {
    const field = GameEntityComponentResolver.fieldFind(gameClass, path);
    if (!field || field.kind === 'group' || field.kind === 'unsupported') {
      result.errors.push(`${gameClass.type_path} has no editable field ${path}`);
    } else if (gameEntityFieldValueNormalize(field, value) === undefined) {
      result.errors.push(`${gameClass.type_path} field ${path} cannot be ${JSON.stringify(value)}`);
    } else {
      result.components = GameEntityComponentsEdit.fieldSet(result.components, gameClass.type_path, field, value);
    }
  }
}
