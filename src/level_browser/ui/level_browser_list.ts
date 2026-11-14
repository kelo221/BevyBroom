import type { LevelBrowserRow } from '@/level_browser/model/level_browser_row_model.js';
import {
  levelBrowserStyleList,
  levelBrowserStyleRow,
  levelBrowserStyleRowDetail,
  levelBrowserStyleRowModified,
  levelBrowserStyleRowName,
  levelBrowserStyleRowSelected,
} from '@/level_browser/ui/level_browser_styles.js';

/** Attribute naming the document of a row element. */
export const LEVEL_BROWSER_ROW_DOCUMENT_ATTRIBUTE = 'data-level-document';

/** What the list reports to the browser. */
export interface LevelBrowserListHost {
  /**
   * Opens the level of an activated row.
   *
   * @param row Activated row.
   */
  rowActivate(row: LevelBrowserRow): void;
  /**
   * Tells which row is selected now.
   *
   * @param row Selected row, or null when nothing is selected.
   */
  rowSelect(row: LevelBrowserRow | null): void;
}

/**
 * Scrollable list of level rows. Click selects a row, double-click or Enter
 * opens it, the arrow keys move the selection.
 */
export class LevelBrowserList {
  readonly element: HTMLElement;
  private readonly host: LevelBrowserListHost;
  private rows: LevelBrowserRow[] = [];
  private rowElements = new Map<string, HTMLElement>();
  private selectedDocument: string | null = null;

  /**
   * Creates an empty, focusable list.
   *
   * @param ownerDocument Document that owns the list.
   * @param host Browser callbacks.
   */
  constructor(ownerDocument: Document, host: LevelBrowserListHost) {
    this.host = host;
    this.element = ownerDocument.createElement('div');
    this.element.tabIndex = 0;
    this.element.setAttribute('role', 'listbox');
    this.element.setAttribute('aria-label', 'Project levels');
    levelBrowserStyleList(this.element);
    this.element.addEventListener('keydown', (event) => this.keyDownHandle(event));
  }

  /**
   * Replaces the rows, keeping the selection when its level is still shown.
   *
   * @param rows Rows in display order.
   */
  render(rows: readonly LevelBrowserRow[]): void {
    this.rows = [...rows];
    this.rowElements = new Map();
    this.element.replaceChildren(...this.rows.map((row) => this.rowElementCreate(row)));
    if (this.selectedDocument !== null && !this.rowElements.has(this.selectedDocument)) {
      this.selectedDocument = null;
    }
    this.selectionShow();
  }

  /**
   * Returns the selected row.
   *
   * @returns Selected row, or null.
   */
  selectedRowRead(): LevelBrowserRow | null {
    return this.rows.find((row) => row.level.document === this.selectedDocument) ?? null;
  }

  /**
   * Selects the row of a document.
   *
   * @param document Document of the row to select, or null to clear.
   */
  selectedDocumentWrite(document: string | null): void {
    this.selectedDocument = document;
    this.selectionShow();
    this.host.rowSelect(this.selectedRowRead());
  }

  /**
   * Builds the element of one row.
   *
   * @param row Row to show.
   * @returns Row element.
   */
  private rowElementCreate(row: LevelBrowserRow): HTMLElement {
    const ownerDocument = this.element.ownerDocument;
    const element = ownerDocument.createElement('div');
    element.setAttribute('role', 'option');
    element.setAttribute(LEVEL_BROWSER_ROW_DOCUMENT_ATTRIBUTE, row.level.document);
    element.title = row.level.document;
    levelBrowserStyleRow(element);
    element.append(
      this.rowNameCreate(ownerDocument, row),
      this.rowTextCreate(ownerDocument, row.modifiedLabel, levelBrowserStyleRowModified),
      this.rowTextCreate(ownerDocument, row.detailLabel, levelBrowserStyleRowDetail),
    );
    element.addEventListener('click', () => this.selectedDocumentWrite(row.level.document));
    element.addEventListener('dblclick', () => this.host.rowActivate(row));
    this.rowElements.set(row.level.document, element);
    return element;
  }

  /**
   * Builds the name line of a row, marking the open level.
   *
   * @param ownerDocument Document that owns the list.
   * @param row Row to show.
   * @returns Name element.
   */
  private rowNameCreate(ownerDocument: Document, row: LevelBrowserRow): HTMLElement {
    const name = ownerDocument.createElement('div');
    name.textContent = row.isOpen ? `${row.level.name} (open)` : row.level.name;
    levelBrowserStyleRowName(name, row.isOpen);
    return name;
  }

  /**
   * Builds a text cell of a row.
   *
   * @param ownerDocument Document that owns the list.
   * @param text Cell text.
   * @param style Styles the cell.
   * @returns Cell element.
   */
  private rowTextCreate(ownerDocument: Document, text: string, style: (element: HTMLElement) => void): HTMLElement {
    const cell = ownerDocument.createElement('div');
    cell.textContent = text;
    style(cell);
    return cell;
  }

  /** Highlights the selected row and marks it for assistive technology. */
  private selectionShow(): void {
    this.rowElements.forEach((element, document) => {
      const isSelected = document === this.selectedDocument;
      levelBrowserStyleRowSelected(element, isSelected);
      element.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    });
  }

  /**
   * Moves the selection with the arrow keys and opens the selected row with
   * Enter.
   *
   * @param event Key press on the list.
   */
  private keyDownHandle(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      const selected = this.selectedRowRead();
      if (selected !== null) {
        event.preventDefault();
        this.host.rowActivate(selected);
      }
      return;
    }
    const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    if (step !== 0) {
      event.preventDefault();
      this.selectionStep(step);
    }
  }

  /**
   * Moves the selection by a number of rows, clamped to the list.
   *
   * @param step Rows to move; negative moves up.
   */
  private selectionStep(step: number): void {
    if (this.rows.length === 0) {
      return;
    }
    const currentIndex = this.rows.findIndex((row) => row.level.document === this.selectedDocument);
    const nextIndex = Math.min(this.rows.length - 1, Math.max(0, currentIndex + step));
    const nextRow = this.rows[nextIndex];
    if (nextRow !== undefined) {
      this.selectedDocumentWrite(nextRow.level.document);
      this.rowElements.get(nextRow.level.document)?.scrollIntoView({ block: 'nearest' });
    }
  }
}
