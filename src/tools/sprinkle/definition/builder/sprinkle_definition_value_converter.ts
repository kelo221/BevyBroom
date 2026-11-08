import type { GameEntityField } from '@/game_entity/class/game_entity_class_schema.js';
import { gameEntityFieldValueNormalize } from '@/game_entity/component/game_entity_component_value.js';
import type {
  PreviewFieldValue,
  PreviewPlaceableFieldKind,
} from '@/preview/protocol/preview_protocol_placeable_types.js';
import type { KeyValuesNode, KeyValuesNodeBlock } from '@/tools/sprinkle/definition/keyvalues/keyvalues_node.js';

/**
 * Turns the text written for a field into a candidate value of the field's
 * kind.
 */
type SprinkleDefinitionTextReader = (text: string) => unknown;

/** Texts read as true for boolean fields. */
const SPRINKLE_DEFINITION_TRUE_TEXTS = new Set(['1', 'true', 'yes']);

/** Texts read as false for boolean fields. */
const SPRINKLE_DEFINITION_FALSE_TEXTS = new Set(['0', 'false', 'no']);

/**
 * Reads a number written as text.
 *
 * @param text Written text.
 * @returns The number, NaN when it is not one, or undefined for blank text.
 */
function sprinkleDefinitionNumberRead(text: string): number | undefined {
  const trimmed = text.trim();
  return trimmed === '' ? undefined : Number(trimmed);
}

/**
 * Reads numbers separated by whitespace.
 *
 * @param text Written text such as "1 2 3".
 * @returns Numbers in order, NaN for parts that are not numbers.
 */
function sprinkleDefinitionNumberListRead(text: string): number[] {
  const trimmed = text.trim();
  return trimmed === '' ? [] : trimmed.split(/\s+/).map(Number);
}

/**
 * Reads a color of three or four channels; a missing alpha is opaque.
 *
 * @param text Written text such as "0.1 0.8 0.3".
 * @returns Channels in order.
 */
function sprinkleDefinitionColorRead(text: string): number[] {
  const channels = sprinkleDefinitionNumberListRead(text);
  return channels.length === 3 ? [...channels, 1] : channels;
}

/**
 * Reads a boolean written as 1, 0, true, false, yes or no.
 *
 * @param text Written text.
 * @returns The boolean, or the text when it is none of those words.
 */
function sprinkleDefinitionBooleanRead(text: string): unknown {
  const lowered = text.trim().toLowerCase();
  if (SPRINKLE_DEFINITION_TRUE_TEXTS.has(lowered)) {
    return true;
  }
  return SPRINKLE_DEFINITION_FALSE_TEXTS.has(lowered) ? false : text;
}

/** Text reader of every field kind not written as plain text. */
const SPRINKLE_DEFINITION_TEXT_READERS: Partial<Record<PreviewPlaceableFieldKind, SprinkleDefinitionTextReader>> = {
  number: sprinkleDefinitionNumberRead,
  integer: sprinkleDefinitionNumberRead,
  bool: sprinkleDefinitionBooleanRead,
  vector2: sprinkleDefinitionNumberListRead,
  vector3: sprinkleDefinitionNumberListRead,
  vector4: sprinkleDefinitionNumberListRead,
  color: sprinkleDefinitionColorRead,
};

/**
 * Converts the values written in sprinkle definition files into component field
 * values.
 */
export class SprinkleDefinitionValueConverter {
  /**
   * Converts a written value into a value that fits a known field.
   *
   * @param field Field the value is written for.
   * @param node Key and value as written.
   * @returns Fitting value, or undefined when the value does not fit the field.
   */
  static fieldValueRead(field: GameEntityField, node: KeyValuesNode): PreviewFieldValue | undefined {
    const candidate =
      node.kind === 'text'
        ? SprinkleDefinitionValueConverter.candidateFromText(field.kind, node.value)
        : SprinkleDefinitionValueConverter.textRecordRead(node);
    return gameEntityFieldValueNormalize(field, candidate);
  }

  /**
   * Keeps a value written for a field the editor does not know: text stays text
   * and a block becomes a map of its text values.
   *
   * @param node Key and value as written.
   * @returns Value kept as written.
   */
  static rawValueRead(node: KeyValuesNode): PreviewFieldValue {
    return node.kind === 'text' ? node.value : SprinkleDefinitionValueConverter.textRecordRead(node);
  }

  /**
   * Turns text into a candidate value of a field kind.
   *
   * @param kind Kind of the field.
   * @param text Written text.
   * @returns Candidate value, the text itself for text-like kinds.
   */
  private static candidateFromText(kind: PreviewPlaceableFieldKind, text: string): unknown {
    const reader = SPRINKLE_DEFINITION_TEXT_READERS[kind];
    return reader ? reader(text) : text;
  }

  /**
   * Reads the text children of a block as a map; nested blocks are left out.
   *
   * @param block Block as written.
   * @returns Child key to text value.
   */
  private static textRecordRead(block: KeyValuesNodeBlock): Record<string, string> {
    const record: Record<string, string> = {};
    block.children.forEach((child) => {
      if (child.kind === 'text') {
        record[child.key] = child.value;
      }
    });
    return record;
  }
}
