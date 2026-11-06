import { Theme } from '@/theme.js';

/** One cell of an entity I/O table row. */
export interface ObjectPropertiesLogicTableCell {
  /** Shown text. */
  readonly text: string;
  /** True to draw the text bold. */
  readonly isBold?: boolean;
  /** Short badge text drawn in front of the text, such as a warning mark. */
  readonly badgeText?: string;
  /** Hover text of the cell. */
  readonly title?: string;
}

/** One row of an entity I/O table. */
export interface ObjectPropertiesLogicTableRow {
  /** Cells in column order. */
  readonly cells: readonly ObjectPropertiesLogicTableCell[];
  /** Status written to the row for styling and lookups, such as `broken`. */
  readonly status: string;
  /** True to draw the whole row in the broken connection color. */
  readonly isBroken: boolean;
}

/** Callbacks of an entity I/O table. */
export interface ObjectPropertiesLogicTableHandlers {
  /** Called with the row index when a row is clicked. */
  readonly onRowSelect: (rowIndex: number) => void;
  /** Called with the row index when a row is double-clicked. */
  readonly onRowActivate: (rowIndex: number) => void;
}

/**
 * Compact, scrolling table of entity I/O connections where one row can be
 * selected by clicking it and activated by double-clicking it.
 */
export class ObjectPropertiesLogicTable {
  private readonly scroller: HTMLElement;
  private readonly body: HTMLTableSectionElement;
  private readonly handlers: ObjectPropertiesLogicTableHandlers;

  /**
   * Creates the table with its header.
   *
   * @param columns Column captions.
   * @param ariaLabel Accessible name of the table.
   * @param handlers Row click callbacks.
   */
  constructor(columns: readonly string[], ariaLabel: string, handlers: ObjectPropertiesLogicTableHandlers) {
    this.handlers = handlers;
    const table = document.createElement('table');
    table.setAttribute('aria-label', ariaLabel);
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.fontSize = '11px';
    table.style.color = Theme.inputTextColor;
    this.body = document.createElement('tbody');
    table.append(this.headerCreate(columns), this.body);
    this.scroller = this.scrollerCreate(table);
  }

  /**
   * Returns the scrolling table element.
   *
   * @returns Table container.
   */
  getElement(): HTMLElement {
    return this.scroller;
  }

  /**
   * Replaces the rows and highlights the selected one.
   *
   * @param rows Rows in order.
   * @param selectedRowIndex Index of the highlighted row, -1 for none.
   */
  rowsWrite(rows: readonly ObjectPropertiesLogicTableRow[], selectedRowIndex: number): void {
    this.body.replaceChildren(
      ...rows.map((row, rowIndex) => this.rowCreate(row, rowIndex, rowIndex === selectedRowIndex)),
    );
  }

  /**
   * Creates the small note line shown above an entity I/O table, such as an
   * explanation of an empty table.
   *
   * @returns Note element.
   */
  static noteCreate(): HTMLElement {
    const note = document.createElement('div');
    note.style.padding = '0 8px 6px';
    note.style.fontSize = '11px';
    return note;
  }

  /**
   * Creates the header row.
   *
   * @param columns Column captions.
   * @returns Table head.
   */
  private headerCreate(columns: readonly string[]): HTMLTableSectionElement {
    const head = document.createElement('thead');
    const row = document.createElement('tr');
    columns.forEach((column) => {
      const cell = document.createElement('th');
      cell.textContent = column;
      cell.style.textAlign = 'left';
      cell.style.fontWeight = '600';
      cell.style.padding = '2px 4px';
      cell.style.color = Theme.buttonTextColor;
      cell.style.borderBottom = `1px solid ${Theme.inputBorderColor}`;
      cell.style.whiteSpace = 'nowrap';
      row.appendChild(cell);
    });
    head.appendChild(row);
    return head;
  }

  /**
   * Wraps the table in a box that scrolls once many rows exist.
   *
   * @param table Table element.
   * @returns Scrolling box.
   */
  private scrollerCreate(table: HTMLTableElement): HTMLElement {
    const scroller = document.createElement('div');
    scroller.style.maxHeight = '160px';
    scroller.style.overflow = 'auto';
    scroller.style.margin = '0 8px 6px';
    scroller.style.border = `1px solid ${Theme.inputBorderColor}`;
    scroller.style.background = Theme.inputBackgroundColor;
    scroller.appendChild(table);
    return scroller;
  }

  /**
   * Creates one body row with its click handlers.
   *
   * @param row Row content.
   * @param rowIndex Row index.
   * @param isSelected True to highlight the row.
   * @returns Row element.
   */
  private rowCreate(row: ObjectPropertiesLogicTableRow, rowIndex: number, isSelected: boolean): HTMLTableRowElement {
    const element = document.createElement('tr');
    element.dataset['logicRowIndex'] = String(rowIndex);
    element.dataset['logicStatus'] = row.status;
    element.setAttribute('aria-selected', String(isSelected));
    element.style.cursor = 'pointer';
    element.style.background = isSelected ? Theme.outlinerSelectedColor : 'transparent';
    element.style.color = row.isBroken ? Theme.logicTargetBrokenColor : 'inherit';
    element.append(...row.cells.map((cell) => this.cellCreate(cell)));
    element.addEventListener('click', () => this.handlers.onRowSelect(rowIndex));
    element.addEventListener('dblclick', () => this.handlers.onRowActivate(rowIndex));
    return element;
  }

  /**
   * Creates one body cell.
   *
   * @param cell Cell content.
   * @returns Cell element.
   */
  private cellCreate(cell: ObjectPropertiesLogicTableCell): HTMLTableCellElement {
    const element = document.createElement('td');
    element.style.padding = '2px 4px';
    element.style.whiteSpace = 'nowrap';
    element.style.fontWeight = cell.isBold ? '700' : 'normal';
    if (cell.title) {
      element.title = cell.title;
    }
    if (cell.badgeText) {
      element.appendChild(this.badgeCreate(cell.badgeText));
    }
    element.appendChild(document.createTextNode(cell.text));
    return element;
  }

  /**
   * Creates a small red badge.
   *
   * @param text Badge text.
   * @returns Badge element.
   */
  private badgeCreate(text: string): HTMLElement {
    const badge = document.createElement('span');
    badge.className = 'object-properties-logic-badge';
    badge.textContent = text;
    badge.style.display = 'inline-block';
    badge.style.minWidth = '12px';
    badge.style.marginRight = '4px';
    badge.style.borderRadius = '2px';
    badge.style.background = Theme.logicTargetBrokenColor;
    badge.style.color = Theme.inverseTextColor;
    badge.style.textAlign = 'center';
    badge.style.fontWeight = '700';
    return badge;
  }
}
