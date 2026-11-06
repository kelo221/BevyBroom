import type * as THREE from 'three';
import { GameEntityLogicMatcher } from '@/game_entity/logic/game_entity_logic_matcher.js';
import type { AuthoredLogicOutput, LogicTargetValidationStatus } from '@/game_entity/logic/game_entity_logic_types.js';
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
import { ObjectPropertiesLogicOutputsClipboard } from './object_properties_logic_outputs_clipboard.js';
import type { ObjectPropertiesLogicOutputsModel } from './object_properties_logic_outputs_model.js';

/** Column captions of the outputs table. */
const OBJECT_PROPERTIES_LOGIC_OUTPUTS_COLUMNS: readonly string[] = [
  'My Output',
  'Target Entity',
  'Via This Input',
  'With Parameter',
  'After Delay',
  'Only Once',
];

/** Badge shown in front of a connection whose target matches nothing. */
const OBJECT_PROPERTIES_LOGIC_OUTPUTS_BROKEN_BADGE = '!';

/** Row buttons of the outputs table. */
type ObjectPropertiesLogicOutputsRowAction = 'add' | 'copy' | 'paste' | 'delete';

/** Text, tooltip and model call of one row button. */
interface ObjectPropertiesLogicOutputsRowActionSpec {
  readonly text: string;
  readonly title: string;
  readonly run: (model: ObjectPropertiesLogicOutputsModel) => void;
}

/** Text, tooltip and model call of every row button. */
const OBJECT_PROPERTIES_LOGIC_OUTPUTS_ROW_ACTIONS: Readonly<
  Record<ObjectPropertiesLogicOutputsRowAction, ObjectPropertiesLogicOutputsRowActionSpec>
> = {
  add: { text: 'Add', title: 'Add an output', run: (model) => model.rowAdd() },
  copy: { text: 'Copy', title: 'Copy the selected output', run: (model) => model.rowCopy() },
  paste: { text: 'Paste', title: 'Paste the copied output', run: (model) => model.rowsPaste() },
  delete: { text: 'Delete', title: 'Delete the selected output', run: (model) => model.rowDelete() },
};

/**
 * Connections section of the Outputs tab: the table of the source object's
 * output rows with their target status, and the Add, Copy, Paste and Delete
 * buttons.
 */
export class ObjectPropertiesLogicOutputsSectionTable extends ObjectPropertiesTabSection {
  private readonly model: ObjectPropertiesLogicOutputsModel;
  private readonly table: ObjectPropertiesLogicTable;
  private readonly note: HTMLElement;
  private readonly buttons: Readonly<Record<ObjectPropertiesLogicOutputsRowAction, HTMLButtonElement>>;

  /**
   * Creates the table and its buttons.
   *
   * @param context Tab context.
   * @param model Outputs state shared with the row editor.
   */
  constructor(context: ObjectPropertiesTabContext, model: ObjectPropertiesLogicOutputsModel) {
    super(context, 'Outputs');
    this.model = model;
    this.table = new ObjectPropertiesLogicTable(OBJECT_PROPERTIES_LOGIC_OUTPUTS_COLUMNS, 'Outputs', {
      onRowSelect: (rowIndex) => model.rowSelect(rowIndex),
      onRowActivate: (rowIndex) => model.rowSelect(rowIndex),
    });
    this.note = ObjectPropertiesLogicTable.noteCreate();
    this.buttons = this.buttonsCreate();
    this.element.append(
      this.note,
      this.table.getElement(),
      objectPropertiesLogicButtonBarCreate(Object.values(this.buttons)),
    );
  }

  /**
   * Shows the source object's rows and enables the buttons that apply.
   *
   * @param _objects Edited objects; the model already holds the source.
   */
  refresh(_objects: readonly THREE.Object3D[]): void {
    const source = this.model.sourceRead();
    const rows = this.model.rowsRead();
    this.note.textContent = source ? '' : 'Select a single object to edit its outputs.';
    this.note.hidden = source !== null;
    this.table.rowsWrite(
      rows.map((row) => this.tableRowCreate(row, source)),
      this.model.selectedRowIndexRead(),
    );
    this.buttonsEnabledWrite(source !== null, this.model.selectedRowRead() !== null);
  }

  /**
   * Builds the table row of one connection.
   *
   * @param row Output row.
   * @param source Object firing the output.
   * @returns Table row.
   */
  private tableRowCreate(row: AuthoredLogicOutput, source: THREE.Object3D | null): ObjectPropertiesLogicTableRow {
    const status = this.statusRead(row, source);
    const isBroken = status === 'broken';
    return {
      status,
      isBroken,
      cells: [
        { text: row.output, badgeText: isBroken ? OBJECT_PROPERTIES_LOGIC_OUTPUTS_BROKEN_BADGE : '' },
        { text: row.target, isBold: status === 'valid_multiple', title: this.statusTitleRead(status) },
        { text: row.input },
        { text: row.parameter },
        { text: row.delay.toFixed(2) },
        { text: row.times_to_fire === 1 ? 'Yes' : 'No' },
      ],
    };
  }

  /**
   * Validates the target of one row.
   *
   * @param row Output row.
   * @param source Object firing the output.
   * @returns Target status.
   */
  private statusRead(row: AuthoredLogicOutput, source: THREE.Object3D | null): LogicTargetValidationStatus {
    if (!source) {
      return 'broken';
    }
    return GameEntityLogicMatcher.targetValidate(source, row.target, this.context.worldObjectRead());
  }

  /**
   * Returns the hover text explaining a target status.
   *
   * @param status Target status.
   * @returns Explanation.
   */
  private statusTitleRead(status: LogicTargetValidationStatus): string {
    if (status === 'broken') {
      return 'No object matches this target';
    }
    return status === 'valid_multiple' ? 'This target matches several objects' : 'This target matches one object';
  }

  /**
   * Creates the Add, Copy, Paste and Delete buttons.
   *
   * @returns Buttons by action.
   */
  private buttonsCreate(): Readonly<Record<ObjectPropertiesLogicOutputsRowAction, HTMLButtonElement>> {
    const model = this.model;
    const buttonCreate = (action: ObjectPropertiesLogicOutputsRowAction): HTMLButtonElement => {
      const spec = OBJECT_PROPERTIES_LOGIC_OUTPUTS_ROW_ACTIONS[action];
      return objectPropertiesLogicButtonCreate({ ...spec, action, onClick: () => spec.run(model) });
    };
    return {
      add: buttonCreate('add'),
      copy: buttonCreate('copy'),
      paste: buttonCreate('paste'),
      delete: buttonCreate('delete'),
    };
  }

  /**
   * Enables the buttons that can act.
   *
   * @param hasSource True when one object's outputs are edited.
   * @param hasSelectedRow True when a row is selected.
   */
  private buttonsEnabledWrite(hasSource: boolean, hasSelectedRow: boolean): void {
    buttonCompactEnabledWrite(this.buttons.add, hasSource);
    buttonCompactEnabledWrite(this.buttons.copy, hasSelectedRow);
    buttonCompactEnabledWrite(this.buttons.paste, hasSource && ObjectPropertiesLogicOutputsClipboard.hasRows());
    buttonCompactEnabledWrite(this.buttons.delete, hasSelectedRow);
  }
}
