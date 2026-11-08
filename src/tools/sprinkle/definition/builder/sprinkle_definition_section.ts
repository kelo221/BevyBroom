import type { GameEntityComponents } from '@/game_entity/component/game_entity_component_store.js';
import type { SprinkleDefinitionGrid } from '@/tools/sprinkle/definition/sprinkle_definition.js';

/** Values written in the base block or in one case block of a sprinkle type. */
export interface SprinkleDefinitionSection {
  /** Entity class id, or null when the block names none. */
  className: string | null;
  /** Grid cell size, or null when the block names none. */
  grid: SprinkleDefinitionGrid | null;
  /** Component field overrides by type path. */
  components: GameEntityComponents;
}

/** Which block of a type a section is read from. */
export type SprinkleDefinitionSectionRole = 'base' | 'case';

/**
 * Creates a section without any values.
 *
 * @returns Empty section.
 */
export function sprinkleDefinitionSectionEmpty(): SprinkleDefinitionSection {
  return { className: null, grid: null, components: {} };
}

/**
 * Merges component overrides, field by field: overrides of the second set
 * replace the same fields of the first.
 *
 * @param under Overrides written first, such as those of the base.
 * @param over Overrides written later, such as those of a case.
 * @returns New overrides holding every component of both.
 */
export function sprinkleDefinitionComponentsMerge(
  under: GameEntityComponents,
  over: GameEntityComponents,
): GameEntityComponents {
  const merged: GameEntityComponents = {};
  for (const typePath of new Set([...Object.keys(under), ...Object.keys(over)])) {
    merged[typePath] = { ...under[typePath], ...over[typePath] };
  }
  return merged;
}
