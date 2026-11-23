import type { GameEntityField } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityComponentResolver } from '@/game_entity/component/game_entity_component_resolver.js';
import type { GameEntityComponents } from '@/game_entity/component/game_entity_component_store.js';
import { gameEntityTextListIs } from '@/game_entity/component/game_entity_component_value.js';
import type { PreviewFieldValue } from '@/preview/protocol/preview_protocol_placeable_types.js';

/** Reads and edits the ordered variant names an enum list field holds. */
export class GameEntityComponentValueList {
  /**
   * Returns the variant names an enum list field of an object holds: its
   * override, else the field default.
   *
   * @param components Component overrides of the object.
   * @param typePath Component type path.
   * @param field Enum list field.
   * @returns Variant names in order, unknown names included; empty when the
   *   value is no list of text.
   */
  static variantsEffective(components: GameEntityComponents, typePath: string, field: GameEntityField): string[] {
    return GameEntityComponentValueList.variantsOf(
      GameEntityComponentResolver.valueEffective(components, typePath, field),
    );
  }

  /**
   * Reads a stored value as a list of variant names.
   *
   * @param value Stored value.
   * @returns Copied names in order; empty when the value is no list of text.
   */
  static variantsOf(value: PreviewFieldValue): string[] {
    return Array.isArray(value) && gameEntityTextListIs(value) ? [...value] : [];
  }

  /**
   * Returns the variant names an enum list field holds that it does not list,
   * such as names the game has dropped.
   *
   * @param field Enum list field.
   * @param variants Variant names held.
   * @returns Unlisted names in order; empty when the field lists no variants.
   */
  static variantsUnknown(field: GameEntityField, variants: readonly string[]): string[] {
    const listed = field.variants ?? [];
    return listed.length === 0 ? [] : variants.filter((variant) => !listed.includes(variant));
  }

  /**
   * Returns a list with one more variant name at its end.
   *
   * @param variants Current names.
   * @param variant Name to add.
   * @returns New list; unchanged when the name is held already.
   */
  static variantAppend(variants: readonly string[], variant: string): string[] {
    return variants.includes(variant) ? [...variants] : [...variants, variant];
  }

  /**
   * Returns a list without one variant name.
   *
   * @param variants Current names.
   * @param variant Name to remove.
   * @returns New list without the name.
   */
  static variantRemove(variants: readonly string[], variant: string): string[] {
    return variants.filter((entry) => entry !== variant);
  }

  /**
   * Returns a list with one variant name moved by a number of places.
   *
   * @param variants Current names.
   * @param variant Name to move.
   * @param offset Places to move: negative toward the start, positive toward
   *   the end. Moves stop at either end.
   * @returns New list; unchanged when the name is not held.
   */
  static variantMove(variants: readonly string[], variant: string, offset: number): string[] {
    const from = variants.indexOf(variant);
    if (from < 0) {
      return [...variants];
    }
    const to = Math.min(variants.length - 1, Math.max(0, from + offset));
    const moved = variants.filter((entry) => entry !== variant);
    moved.splice(to, 0, variant);
    return moved;
  }
}
