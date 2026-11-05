import {
  PANEL_PROPERTIES_GROUP_ROW_DATASET_KEY,
  PANEL_PROPERTIES_ROW_DATASET_KEY,
} from '@/ui/properties/panel_properties_row.js';
import { ObjectPropertiesKeyvalueRowSelection } from './object_properties_keyvalue_row_selection.js';
import {
  KEYVALUE_TABLE_BODY_CLASS,
  KEYVALUE_TABLE_FRAME_CLASS,
  KEYVALUE_TABLE_GROUP_ROW_CLASS,
  KEYVALUE_TABLE_HEADER_CELL_CLASS,
  KEYVALUE_TABLE_HEADER_CLASS,
  KEYVALUE_TABLE_NAME_CELL_CLASS,
  KEYVALUE_TABLE_ROW_CLASS,
  objectPropertiesKeyvalueTableStylesEnsure,
} from './object_properties_keyvalue_table_styles.js';

/** Data attribute key marking rows the table already styled. */
const KEYVALUE_TABLE_DECORATED_DATASET_KEY = 'keyvalueRowDecorated';

/** Data attribute key marking the selected row. */
const KEYVALUE_TABLE_SELECTED_DATASET_KEY = 'keyvalueRowSelected';

/**
 * Hammer's Property Name | Value table: a bordered, scrolling grid with a
 * header row that presents every labeled field row of its content as a table
 * row and every group row as a subtle group line, whoever built them, and lets
 * the user select one row.
 */
export class ObjectPropertiesKeyvalueTable {
  private readonly element: HTMLElement;
  private readonly body: HTMLElement;
  private readonly onSelectionChange: (selection: ObjectPropertiesKeyvalueRowSelection | null) => void;
  private selection: ObjectPropertiesKeyvalueRowSelection | null;

  /**
   * Creates an empty table.
   *
   * @param onSelectionChange Called with the selected row, or null when the
   *   selection is gone.
   */
  constructor(onSelectionChange: (selection: ObjectPropertiesKeyvalueRowSelection | null) => void) {
    this.onSelectionChange = onSelectionChange;
    this.selection = null;
    objectPropertiesKeyvalueTableStylesEnsure(document);
    this.body = document.createElement('div');
    this.body.className = KEYVALUE_TABLE_BODY_CLASS;
    this.element = this.frameCreate();
  }

  /**
   * Returns the table element.
   *
   * @returns Table root.
   */
  getElement(): HTMLElement {
    return this.element;
  }

  /**
   * Shows content in the table body.
   *
   * @param content Elements holding labeled field rows.
   */
  contentWrite(content: readonly HTMLElement[]): void {
    this.body.replaceChildren(...content);
    this.rowsDecorate();
  }

  /**
   * Presents rows added since the last call as table rows and group rows and
   * drops a selection whose row is gone.
   */
  rowsDecorate(): void {
    this.rowsList().forEach((row) => this.rowDecorate(row));
    this.groupRowsList().forEach((row) => row.classList.add(KEYVALUE_TABLE_GROUP_ROW_CLASS));
    if (this.selection && !this.body.contains(this.selection.row)) {
      this.selectionWrite(null);
    }
  }

  /**
   * Returns the selected row.
   *
   * @returns Selection, or null when no row is selected.
   */
  selectionRead(): ObjectPropertiesKeyvalueRowSelection | null {
    return this.selection;
  }

  /**
   * Returns every labeled field row in the body.
   *
   * @returns Row elements in document order.
   */
  rowsList(): HTMLElement[] {
    return this.bodyElementsWithDataset(PANEL_PROPERTIES_ROW_DATASET_KEY);
  }

  /**
   * Returns every group row in the body.
   *
   * @returns Group row elements in document order.
   */
  groupRowsList(): HTMLElement[] {
    return this.bodyElementsWithDataset(PANEL_PROPERTIES_GROUP_ROW_DATASET_KEY);
  }

  /**
   * Returns the body elements carrying a data attribute.
   *
   * @param datasetKey Dataset key of the attribute.
   * @returns Elements in document order.
   */
  private bodyElementsWithDataset(datasetKey: string): HTMLElement[] {
    const attributeName = datasetKey.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
    return [...this.body.querySelectorAll<HTMLElement>(`[data-${attributeName}]`)];
  }

  /**
   * Presents one row as a table row and makes it selectable, once.
   *
   * @param row Labeled field row.
   */
  private rowDecorate(row: HTMLElement): void {
    if (row.dataset[KEYVALUE_TABLE_DECORATED_DATASET_KEY] === 'true') {
      return;
    }
    row.dataset[KEYVALUE_TABLE_DECORATED_DATASET_KEY] = 'true';
    row.classList.add(KEYVALUE_TABLE_ROW_CLASS);
    row.firstElementChild?.classList.add(KEYVALUE_TABLE_NAME_CELL_CLASS);
    row.addEventListener('pointerdown', () => this.selectionWrite(new ObjectPropertiesKeyvalueRowSelection(row)));
    row.addEventListener('focusin', () => this.selectionWrite(new ObjectPropertiesKeyvalueRowSelection(row)));
  }

  /**
   * Selects a row, marking it highlighted, and reports the change.
   *
   * @param selection New selection, or null.
   */
  private selectionWrite(selection: ObjectPropertiesKeyvalueRowSelection | null): void {
    if (selection && this.selection?.row === selection.row) {
      return;
    }
    if (this.selection) {
      delete this.selection.row.dataset[KEYVALUE_TABLE_SELECTED_DATASET_KEY];
    }
    this.selection = selection;
    if (selection) {
      selection.row.dataset[KEYVALUE_TABLE_SELECTED_DATASET_KEY] = 'true';
    }
    this.onSelectionChange(selection);
  }

  /**
   * Builds the bordered frame with the column header above the body.
   *
   * @returns Frame element.
   */
  private frameCreate(): HTMLElement {
    const frame = document.createElement('div');
    frame.className = KEYVALUE_TABLE_FRAME_CLASS;
    frame.setAttribute('role', 'table');
    frame.setAttribute('aria-label', 'Keyvalues');
    frame.append(this.headerCreate(), this.body);
    return frame;
  }

  /**
   * Creates the Property Name | Value header row.
   *
   * @returns Header row.
   */
  private headerCreate(): HTMLElement {
    const header = document.createElement('div');
    header.className = KEYVALUE_TABLE_HEADER_CLASS;
    header.setAttribute('role', 'row');
    header.append(
      ObjectPropertiesKeyvalueTable.headerCellCreate('Property Name'),
      ObjectPropertiesKeyvalueTable.headerCellCreate('Value'),
    );
    return header;
  }

  /**
   * Creates one header cell.
   *
   * @param text Column title.
   * @returns Header cell.
   */
  private static headerCellCreate(text: string): HTMLElement {
    const cell = document.createElement('span');
    cell.className = KEYVALUE_TABLE_HEADER_CELL_CLASS;
    cell.setAttribute('role', 'columnheader');
    cell.textContent = text;
    return cell;
  }
}
