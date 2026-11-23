import type { GameEntityField } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityClassVariantNames } from '@/game_entity/class/game_entity_class_variant_names.js';
import type { InputSelectChoice } from '@/ui/input/input_select.js';

/**
 * Builds the select entries of a field with a fixed set of values: enum and
 * enum list variants show their display name under their group, other values
 * show as they are.
 */
export class GameEntityFieldVariantChoices {
  /**
   * Returns the entries of values, each group's entries together.
   *
   * @param field Field the values belong to.
   * @param values Variant names or asset paths in order.
   * @returns Select entries, ungrouped ones first.
   */
  static choicesOf(field: GameEntityField, values: readonly string[]): InputSelectChoice[] {
    return GameEntityFieldVariantChoices.choicesGroupedTogether(
      values.map((value) => GameEntityFieldVariantChoices.choiceOf(field, value)),
    );
  }

  /**
   * Returns the entry of one value.
   *
   * @param field Field the value belongs to.
   * @param value Variant name or asset path.
   * @returns Select entry storing the value.
   */
  private static choiceOf(field: GameEntityField, value: string): InputSelectChoice {
    if (field.kind !== 'enum' && field.kind !== 'enum_list') {
      return { value, label: value };
    }
    const label = GameEntityClassVariantNames.labelOf(field, value);
    const group = GameEntityClassVariantNames.groupOf(field, value);
    const choice: InputSelectChoice = { value, label, title: value };
    if (group !== null) {
      choice.group = group;
    }
    return choice;
  }

  /**
   * Orders entries so ungrouped ones come first and each group's entries sit
   * together, groups in the order their first entry appears.
   *
   * @param choices Entries in value order.
   * @returns Reordered entries, value order kept within each group.
   */
  private static choicesGroupedTogether(choices: readonly InputSelectChoice[]): InputSelectChoice[] {
    const groupOrder = [...new Set(choices.map((choice) => choice.group ?? ''))];
    const groupRankOf = (choice: InputSelectChoice): number =>
      choice.group === undefined ? -1 : groupOrder.indexOf(choice.group);
    return [...choices].sort((first, second) => groupRankOf(first) - groupRankOf(second));
  }
}
