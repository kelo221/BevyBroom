import { SprinkleDefinitionBuilder } from '@/tools/sprinkle/definition/builder/sprinkle_definition_builder.js';
import type { SprinkleDefinition } from '@/tools/sprinkle/definition/sprinkle_definition.js';
import { SPRINKLE_DEFINITION_BUILTIN_FILES } from './sprinkle_definition_builtin_files.js';

/** Builds the sprinkle definitions that ship with the editor. */
export class SprinkleDefinitionBuiltin {
  /**
   * Builds the built-in sample definitions.
   *
   * @returns Built-in definitions in Type list order.
   */
  static definitionsBuild(): readonly SprinkleDefinition[] {
    return new SprinkleDefinitionBuilder().filesBuild(SPRINKLE_DEFINITION_BUILTIN_FILES).definitions;
  }
}
