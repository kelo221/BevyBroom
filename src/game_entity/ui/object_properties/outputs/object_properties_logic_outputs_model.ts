import type * as THREE from 'three';
import { CommandGameEntityLogicSet } from '@/game_entity/logic/command_game_entity_logic_set.js';
import { GameEntityLogicMatcher } from '@/game_entity/logic/game_entity_logic_matcher.js';
import { GameEntityLogicPins } from '@/game_entity/logic/game_entity_logic_pins.js';
import { GameEntityLogicStore } from '@/game_entity/logic/game_entity_logic_store.js';
import type { AuthoredLogicOutput } from '@/game_entity/logic/game_entity_logic_types.js';
import type { ObjectPropertiesTabContext } from '@/ui/object_properties/registry/registry_object_properties_tab.js';
import { objectPropertiesTabCommandPush } from '@/ui/object_properties/tabs/object_properties_tab_section.js';
import { ObjectPropertiesLogicOutputsClipboard } from './object_properties_logic_outputs_clipboard.js';

/**
 * State the Outputs tab shares between its table and its row editor: the object
 * whose outputs are edited and the selected row. Every row edit is one undoable
 * command pushed through the dialog.
 */
export class ObjectPropertiesLogicOutputsModel {
  private readonly context: ObjectPropertiesTabContext;
  private changeListener: () => void;
  private sourceObject: THREE.Object3D | null;
  private selectedRowIndex: number;

  /**
   * Creates the model without a source object.
   *
   * @param context Tab context edits are pushed through.
   */
  constructor(context: ObjectPropertiesTabContext) {
    this.context = context;
    this.changeListener = () => {};
    this.sourceObject = null;
    this.selectedRowIndex = -1;
  }

  /**
   * Sets the callback run after the rows or the selected row changed.
   *
   * @param listener Change callback.
   */
  changeListenerWrite(listener: () => void): void {
    this.changeListener = listener;
  }

  /**
   * Edits the outputs of the only edited object, or of none when several
   * objects are edited, keeping the selected row in range.
   *
   * @param objects Edited objects.
   */
  sourceWrite(objects: readonly THREE.Object3D[]): void {
    const nextSource = objects.length === 1 ? (objects[0] ?? null) : null;
    if (nextSource !== this.sourceObject) {
      this.sourceObject = nextSource;
      this.selectedRowIndex = 0;
    }
    this.selectedRowIndex = this.rowIndexClamp(this.selectedRowIndex);
  }

  /**
   * Returns the object whose outputs are edited.
   *
   * @returns Source object, or null when not exactly one object is edited.
   */
  sourceRead(): THREE.Object3D | null {
    return this.sourceObject;
  }

  /**
   * Returns the output rows of the source object.
   *
   * @returns Rows, empty without a source.
   */
  rowsRead(): AuthoredLogicOutput[] {
    return this.sourceObject ? GameEntityLogicStore.read(this.sourceObject) : [];
  }

  /**
   * Returns the index of the selected row.
   *
   * @returns Row index, -1 when no row is selected.
   */
  selectedRowIndexRead(): number {
    return this.selectedRowIndex;
  }

  /**
   * Returns the selected row.
   *
   * @returns Selected row, or null.
   */
  selectedRowRead(): AuthoredLogicOutput | null {
    return this.rowsRead()[this.selectedRowIndex] ?? null;
  }

  /**
   * Selects one row.
   *
   * @param rowIndex Row index.
   */
  rowSelect(rowIndex: number): void {
    this.selectedRowIndex = this.rowIndexClamp(rowIndex);
    this.changeListener();
  }

  /**
   * Returns the objects a row's target names from the source object.
   *
   * @param row Output row.
   * @returns Matching scene objects.
   */
  targetsResolve(row: AuthoredLogicOutput): THREE.Object3D[] {
    if (!this.sourceObject) {
      return [];
    }
    return GameEntityLogicMatcher.targetsResolve(this.sourceObject, row.target, this.context.worldObjectRead());
  }

  /**
   * Appends a new row firing the first output of the source's classes and
   * selects it.
   */
  rowAdd(): void {
    if (!this.sourceObject) {
      return;
    }
    const firstOutput = GameEntityLogicPins.outputsOfObject(this.sourceObject)[0]?.name ?? '';
    const rows = this.rowsRead();
    const added: AuthoredLogicOutput = {
      output: firstOutput,
      target: '',
      input: '',
      parameter: '',
      delay: 0,
      times_to_fire: -1,
    };
    this.rowsCommit([...rows, added], rows.length);
  }

  /** Deletes the selected row. */
  rowDelete(): void {
    const rows = this.rowsRead();
    if (!rows[this.selectedRowIndex]) {
      return;
    }
    const remaining = rows.filter((_row, rowIndex) => rowIndex !== this.selectedRowIndex);
    this.rowsCommit(remaining, Math.min(this.selectedRowIndex, remaining.length - 1));
  }

  /** Copies the selected row for pasting. */
  rowCopy(): void {
    const row = this.selectedRowRead();
    if (row) {
      ObjectPropertiesLogicOutputsClipboard.rowsCopy([row]);
      this.changeListener();
    }
  }

  /** Appends the copied rows and selects the last one. */
  rowsPaste(): void {
    const copied = ObjectPropertiesLogicOutputsClipboard.rowsRead();
    if (!this.sourceObject || copied.length === 0) {
      return;
    }
    const rows = [...this.rowsRead(), ...copied];
    this.rowsCommit(rows, rows.length - 1);
  }

  /**
   * Changes fields of the selected row.
   *
   * @param patch Fields to change.
   */
  selectedRowPatch(patch: Partial<AuthoredLogicOutput>): void {
    const rows = this.rowsRead();
    const row = rows[this.selectedRowIndex];
    if (!row) {
      return;
    }
    const patched = { ...row, ...patch };
    if (JSON.stringify(GameEntityLogicStore.rowSanitize(patched)) === JSON.stringify(row)) {
      this.changeListener();
      return;
    }
    rows[this.selectedRowIndex] = patched;
    this.rowsCommit(rows, this.selectedRowIndex);
  }

  /**
   * Stores new rows on the source as one undoable edit and selects a row.
   *
   * @param rows Rows to store.
   * @param selectedRowIndex Row selected afterwards.
   */
  private rowsCommit(rows: readonly AuthoredLogicOutput[], selectedRowIndex: number): void {
    if (!this.sourceObject) {
      return;
    }
    objectPropertiesTabCommandPush(this.context, new CommandGameEntityLogicSet(this.sourceObject, rows));
    this.selectedRowIndex = this.rowIndexClamp(selectedRowIndex);
    this.changeListener();
  }

  /**
   * Keeps a row index inside the source's rows.
   *
   * @param rowIndex Wanted index.
   * @returns Valid index, -1 when there are no rows.
   */
  private rowIndexClamp(rowIndex: number): number {
    const rowCount = this.rowsRead().length;
    return rowCount === 0 ? -1 : Math.min(Math.max(rowIndex, 0), rowCount - 1);
  }
}
