import { GameEntityLogicStore } from '@/game_entity/logic/game_entity_logic_store.js';
import type { AuthoredLogicOutput } from '@/game_entity/logic/game_entity_logic_types.js';

/**
 * Output connection rows copied in the Outputs tab, kept while the editor runs
 * so they can be pasted onto another object.
 */
export class ObjectPropertiesLogicOutputsClipboard {
  private static copiedRows: AuthoredLogicOutput[] = [];

  /**
   * Replaces the copied rows.
   *
   * @param rows Rows to copy.
   */
  static rowsCopy(rows: readonly AuthoredLogicOutput[]): void {
    ObjectPropertiesLogicOutputsClipboard.copiedRows = rows.map((row) => GameEntityLogicStore.rowSanitize(row));
  }

  /**
   * Returns copies of the copied rows.
   *
   * @returns Copied rows, empty when nothing was copied.
   */
  static rowsRead(): AuthoredLogicOutput[] {
    return ObjectPropertiesLogicOutputsClipboard.copiedRows.map((row) => ({ ...row }));
  }

  /**
   * Returns whether rows were copied.
   *
   * @returns True when Paste has something to add.
   */
  static hasRows(): boolean {
    return ObjectPropertiesLogicOutputsClipboard.copiedRows.length > 0;
  }

  /** Forgets the copied rows. */
  static clear(): void {
    ObjectPropertiesLogicOutputsClipboard.copiedRows = [];
  }
}
