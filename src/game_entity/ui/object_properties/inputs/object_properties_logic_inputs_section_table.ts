import type * as THREE from 'three';
import { GameEntityLogicMatcher } from '@/game_entity/logic/game_entity_logic_matcher.js';
import type { LogicIncomingConnection } from '@/game_entity/logic/game_entity_logic_types.js';
import { buttonCompactEnabledWrite } from '@/ui/button/button_compact.js';
import type { ObjectPropertiesTabContext } from '@/ui/object_properties/registry/registry_object_properties_tab.js';
import { ObjectPropertiesTabSection } from '@/ui/object_properties/tabs/object_properties_tab_section.js';
import {
  objectPropertiesLogicButtonBarCreate,
  objectPropertiesLogicButtonCreate,
} from '../table/object_properties_logic_button_bar.js';
import {
  ObjectPropertiesLogicTable,
  type ObjectPropertiesLogicTableRow,
} from '../table/object_properties_logic_table.js';

/** Column captions of the inputs table. */
const OBJECT_PROPERTIES_LOGIC_INPUTS_COLUMNS: readonly string[] = [
  'Source',
  'Output',
  'My Input',
  'Delay',
  'Once',
  'Parameter',
];

/**
 * Read-only section of the Inputs tab: every output connection in the scene
 * whose target reaches the edited object. Mark or a double-click selects the
 * object firing the connection; the double-click also frames it.
 */
export class ObjectPropertiesLogicInputsSectionTable extends ObjectPropertiesTabSection {
  private readonly table: ObjectPropertiesLogicTable;
  private readonly note: HTMLElement;
  private readonly markButton: HTMLButtonElement;
  private connections: LogicIncomingConnection[];
  private selectedRowIndex: number;

  /**
   * Creates the inputs table and its Mark button.
   *
   * @param context Tab context used to read the scene and mark sources.
   */
  constructor(context: ObjectPropertiesTabContext) {
    super(context, 'Inputs');
    this.connections = [];
    this.selectedRowIndex = -1;
    this.table = new ObjectPropertiesLogicTable(OBJECT_PROPERTIES_LOGIC_INPUTS_COLUMNS, 'Inputs', {
      onRowSelect: (rowIndex) => this.rowSelect(rowIndex),
      onRowActivate: (rowIndex) => this.sourceMark(rowIndex, true),
    });
    this.note = ObjectPropertiesLogicTable.noteCreate();
    this.markButton = objectPropertiesLogicButtonCreate({
      text: 'Mark',
      title: 'Select the object firing the selected connection',
      action: 'mark-source',
      onClick: () => this.sourceMark(this.selectedRowIndex, false),
    });
    this.element.append(this.note, this.table.getElement(), objectPropertiesLogicButtonBarCreate([this.markButton]));
  }

  /**
   * Lists the connections reaching the only edited object.
   *
   * @param objects Edited objects.
   */
  refresh(objects: readonly THREE.Object3D[]): void {
    const target = objects.length === 1 ? (objects[0] ?? null) : null;
    this.connections = target
      ? GameEntityLogicMatcher.incomingConnectionsCollect(target, this.context.worldObjectRead())
      : [];
    this.selectedRowIndex = Math.min(Math.max(this.selectedRowIndex, 0), this.connections.length - 1);
    this.noteWrite(target !== null);
    this.tableWrite();
  }

  /**
   * Selects one row.
   *
   * @param rowIndex Row index.
   */
  private rowSelect(rowIndex: number): void {
    this.selectedRowIndex = rowIndex;
    this.tableWrite();
  }

  /**
   * Selects the object firing one connection.
   *
   * @param rowIndex Row index.
   * @param shouldFrame True to frame the object in the views too.
   */
  private sourceMark(rowIndex: number, shouldFrame: boolean): void {
    const connection = this.connections[rowIndex];
    if (connection) {
      this.context.objectsMark([connection.sourceObject], shouldFrame);
    }
  }

  /** Draws the rows and enables Mark while a row is selected. */
  private tableWrite(): void {
    this.table.rowsWrite(
      this.connections.map((connection) => ObjectPropertiesLogicInputsSectionTable.tableRowCreate(connection)),
      this.selectedRowIndex,
    );
    buttonCompactEnabledWrite(this.markButton, this.connections[this.selectedRowIndex] !== undefined);
  }

  /**
   * Explains an empty table.
   *
   * @param hasTarget True when exactly one object is edited.
   */
  private noteWrite(hasTarget: boolean): void {
    if (!hasTarget) {
      this.note.textContent = 'Select a single object to see its inputs.';
    } else {
      this.note.textContent = this.connections.length === 0 ? 'No output targets this object.' : '';
    }
    this.note.hidden = this.note.textContent === '';
  }

  /**
   * Builds the table row of one incoming connection.
   *
   * @param connection Incoming connection.
   * @returns Table row.
   */
  private static tableRowCreate(connection: LogicIncomingConnection): ObjectPropertiesLogicTableRow {
    const row = connection.row;
    return {
      status: 'incoming',
      isBroken: false,
      cells: [
        { text: connection.sourceName },
        { text: row.output },
        { text: row.input },
        { text: row.delay.toFixed(2) },
        { text: row.times_to_fire === 1 ? 'Yes' : 'No' },
        { text: row.parameter },
      ],
    };
  }
}
