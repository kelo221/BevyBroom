import type { GameEntityComponents } from '@/game_entity/component/game_entity_component_store.js';

/** Grid cell size of a sprinkle definition, in meters. */
export interface SprinkleDefinitionGrid {
  /** Cell size along the first in-plane axis. */
  readonly sizeU: number;
  /** Cell size along the second in-plane axis. */
  readonly sizeV: number;
}

/** One weighted case of a sprinkle definition, with the base values merged in. */
export interface SprinkleDefinitionCase {
  /** Relative chance of the case being chosen, greater than zero. */
  readonly weight: number;
  /** Entity class id placed for the case. */
  readonly className: string;
  /** Component field overrides written onto the placed entity. */
  readonly components: GameEntityComponents;
}

/** One sprinkle type read from a definition file. */
export interface SprinkleDefinition {
  /** Name shown in the Type list; unique among loaded definitions. */
  readonly name: string;
  /** Definition file path relative to the project asset root, forward slashes. */
  readonly sourcePath: string;
  /** Default grid of the type, or null when the file names none. */
  readonly grid: SprinkleDefinitionGrid | null;
  /** Weighted cases, at least one. */
  readonly cases: readonly SprinkleDefinitionCase[];
}

/** One sprinkle definition file as read from the project. */
export interface SprinkleDefinitionFile {
  /** File path relative to the project asset root, forward slashes. */
  readonly path: string;
  /** Full text of the file. */
  readonly text: string;
}

/** Result of reading every sprinkle definition file of the open project. */
export type SprinkleDefinitionFilesReadResult =
  | { readonly ok: true; readonly files: readonly SprinkleDefinitionFile[] }
  | { readonly ok: false; readonly message: string };

/** Result of opening a sprinkle definition file in the system's text editor. */
export type SprinkleDefinitionOpenResult = { readonly ok: true } | { readonly ok: false; readonly message: string };
