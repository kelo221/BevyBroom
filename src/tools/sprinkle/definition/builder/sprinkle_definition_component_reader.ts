import type { GameEntityClass } from '@/game_entity/class/game_entity_class_schema.js';
import { GameEntityComponentResolver } from '@/game_entity/component/game_entity_component_resolver.js';
import type { PreviewComponentFields } from '@/preview/protocol/preview_protocol_placeable_types.js';
import type { KeyValuesNode, KeyValuesNodeBlock } from '@/tools/sprinkle/definition/keyvalues/keyvalues_node.js';
import type { SprinkleDefinitionFileProblems } from './sprinkle_definition_file_problems.js';
import { SprinkleDefinitionValueConverter } from './sprinkle_definition_value_converter.js';

/** Finds the game component class with a type path. */
export type SprinkleDefinitionClassLookup = (typePath: string) => GameEntityClass | null;

/**
 * Reads a component block of a sprinkle definition, whose key is a component
 * type path and whose entries are field overrides. Values are converted to
 * their field's kind when the class is known; values of unknown classes and
 * fields stay as written.
 */
export class SprinkleDefinitionComponentReader {
  private readonly classLookup: SprinkleDefinitionClassLookup;

  /**
   * Creates the reader.
   *
   * @param classLookup Finds the game component class of a type path.
   */
  constructor(classLookup: SprinkleDefinitionClassLookup) {
    this.classLookup = classLookup;
  }

  /**
   * Reads the field overrides of one component block.
   *
   * @param block Block keyed by the component type path.
   * @param problems Collects values that do not fit their field.
   * @returns Field path to value.
   */
  read(block: KeyValuesNodeBlock, problems: SprinkleDefinitionFileProblems): PreviewComponentFields {
    const gameClass = this.classLookup(block.key);
    const fields: PreviewComponentFields = {};
    block.children.forEach((child) => this.fieldRead(gameClass, block.key, child, fields, problems));
    return fields;
  }

  /**
   * Reads one field override into the fields of the component.
   *
   * @param gameClass Known class of the component, or null.
   * @param typePath Component type path named in problems.
   * @param node Field path and value as written.
   * @param fields Fields read so far, extended in place.
   * @param problems Collects values that do not fit their field.
   */
  private fieldRead(
    gameClass: GameEntityClass | null,
    typePath: string,
    node: KeyValuesNode,
    fields: PreviewComponentFields,
    problems: SprinkleDefinitionFileProblems,
  ): void {
    const field = gameClass === null ? null : GameEntityComponentResolver.fieldFind(gameClass, node.key);
    if (field === null) {
      fields[node.key] = SprinkleDefinitionValueConverter.rawValueRead(node);
      return;
    }
    const value = SprinkleDefinitionValueConverter.fieldValueRead(field, node);
    if (value === undefined) {
      problems.report(node.line, `value of "${node.key}" does not fit the ${field.kind} field of ${typePath}; ignored`);
      return;
    }
    fields[node.key] = value;
  }
}
