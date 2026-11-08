import { GameEntityClassRegistry } from '@/game_entity/class/game_entity_class_registry.js';
import type { GameEntityClass } from '@/game_entity/class/game_entity_class_schema.js';
import type { KeyValuesNode } from '@/tools/sprinkle/definition/keyvalues/keyvalues_node.js';
import { KeyValuesParseError } from '@/tools/sprinkle/definition/keyvalues/keyvalues_parse_error.js';
import { KeyValuesParser } from '@/tools/sprinkle/definition/keyvalues/keyvalues_parser.js';
import type { SprinkleDefinition, SprinkleDefinitionFile } from '@/tools/sprinkle/definition/sprinkle_definition.js';
import type { SprinkleDefinitionLibraryLoadResult } from '@/tools/sprinkle/definition/state_sprinkle_definition_library.js';
import {
  SprinkleDefinitionComponentReader,
  type SprinkleDefinitionClassLookup,
} from './sprinkle_definition_component_reader.js';
import { SprinkleDefinitionFileProblems } from './sprinkle_definition_file_problems.js';
import { SprinkleDefinitionSectionReader } from './sprinkle_definition_section_reader.js';
import { SprinkleDefinitionTypeReader } from './sprinkle_definition_type_reader.js';

/**
 * Finds a game component class in the editor's class registry.
 *
 * @param typePath Component type path.
 * @returns The class, or null when the editor does not know it.
 */
function sprinkleDefinitionClassLookupRegistry(typePath: string): GameEntityClass | null {
  return GameEntityClassRegistry.classFind(typePath);
}

/**
 * Turns the texts of sprinkle definition files into sprinkle types. Every file
 * may hold several types; a file that cannot be parsed, and every type or case
 * that cannot be used, is reported and skipped. Type names are unique: the
 * first type of a name wins.
 */
export class SprinkleDefinitionBuilder {
  private readonly typeReader: SprinkleDefinitionTypeReader;

  /**
   * Creates the builder.
   *
   * @param classLookup Finds the game component class of a type path, used to
   *   convert field values; the editor's class registry by default.
   */
  constructor(classLookup: SprinkleDefinitionClassLookup = sprinkleDefinitionClassLookupRegistry) {
    const componentReader = new SprinkleDefinitionComponentReader(classLookup);
    this.typeReader = new SprinkleDefinitionTypeReader(new SprinkleDefinitionSectionReader(componentReader));
  }

  /**
   * Builds the types of every file.
   *
   * @param files Definition files in Type list order.
   * @returns Types in file order and every problem found.
   */
  filesBuild(files: readonly SprinkleDefinitionFile[]): SprinkleDefinitionLibraryLoadResult {
    const definitions: SprinkleDefinition[] = [];
    const problems: string[] = [];
    files.forEach((file) => this.fileBuild(file, definitions, new SprinkleDefinitionFileProblems(file.path, problems)));
    return { definitions, problems };
  }

  /**
   * Builds the types of one file and adds those with new names.
   *
   * @param file Definition file.
   * @param definitions Types built so far, extended in place.
   * @param problems Collects the problems of the file.
   */
  private fileBuild(
    file: SprinkleDefinitionFile,
    definitions: SprinkleDefinition[],
    problems: SprinkleDefinitionFileProblems,
  ): void {
    for (const node of SprinkleDefinitionBuilder.nodesParse(file, problems)) {
      if (definitions.some((definition) => definition.name === node.key)) {
        problems.report(node.line, `type "${node.key}" is already defined; this one is ignored`);
        continue;
      }
      const definition = this.typeReader.read(node, problems);
      if (definition !== null) {
        definitions.push(definition);
      }
    }
  }

  /**
   * Parses one file, reporting a parse error instead of throwing it.
   *
   * @param file Definition file.
   * @param problems Collects the parse error.
   * @returns Top-level nodes, empty when the file cannot be parsed.
   */
  private static nodesParse(file: SprinkleDefinitionFile, problems: SprinkleDefinitionFileProblems): KeyValuesNode[] {
    try {
      return KeyValuesParser.parse(file.text, file.path);
    } catch (error) {
      if (error instanceof KeyValuesParseError) {
        problems.messageAdd(error.message);
        return [];
      }
      throw error;
    }
  }
}
