import type * as THREE from 'three';
import { InputText } from '@/ui/input/input_text.js';
import { panelPropertiesRowCreate, panelPropertiesRowMark } from '@/ui/properties/panel_properties_row.js';
import type { ObjectPropertiesKeyvalueRawRow } from './object_properties_keyvalue_raw_row.js';
import type { ObjectPropertiesKeyvalueRawSource } from './object_properties_keyvalue_raw_source.js';

/** Returns the caption a raw row shows. */
export type ObjectPropertiesKeyvalueRawRowCaption = (row: ObjectPropertiesKeyvalueRawRow) => string;

/** One shown text row with the keyvalue it commits to. */
interface ObjectPropertiesKeyvalueRawRowShown {
  readonly input: InputText;
  row: ObjectPropertiesKeyvalueRawRow;
}

/**
 * List of text rows for the keyvalues of raw sources. Rows are kept while the
 * keys stay the same, so refreshes only rewrite their values.
 */
export class ObjectPropertiesKeyvalueRawRowList {
  private readonly element: HTMLElement;
  private readonly sources: readonly ObjectPropertiesKeyvalueRawSource[];
  private readonly captionOf: ObjectPropertiesKeyvalueRawRowCaption;
  private readonly shownByKey: Map<string, ObjectPropertiesKeyvalueRawRowShown>;

  /**
   * Creates an empty list.
   *
   * @param sources Keyvalue sources in display order.
   * @param captionOf Returns the caption of a row.
   */
  constructor(sources: readonly ObjectPropertiesKeyvalueRawSource[], captionOf: ObjectPropertiesKeyvalueRawRowCaption) {
    this.sources = sources;
    this.captionOf = captionOf;
    this.shownByKey = new Map();
    this.element = document.createElement('div');
    this.element.className = 'object-properties-keyvalues-raw';
  }

  /**
   * Returns the list element.
   *
   * @returns List root.
   */
  getElement(): HTMLElement {
    return this.element;
  }

  /**
   * Shows the keyvalues of the edited objects.
   *
   * @param objects Edited objects.
   */
  refresh(objects: readonly THREE.Object3D[]): void {
    const rows = this.sources.flatMap((source) => source.rowsCreate(objects));
    const keys = rows.map((row) => row.key);
    if (keys.join('\u0000') !== [...this.shownByKey.keys()].join('\u0000')) {
      this.rowsRebuild(rows);
    }
    rows.forEach((row) => this.rowValuesWrite(row));
  }

  /**
   * Replaces every shown row with rows for new keys.
   *
   * @param rows Keyvalues to show.
   */
  private rowsRebuild(rows: readonly ObjectPropertiesKeyvalueRawRow[]): void {
    this.shownByKey.clear();
    this.element.replaceChildren(...rows.map((row) => this.rowElementCreate(row)));
  }

  /**
   * Creates the text row of one keyvalue.
   *
   * @param row Keyvalue.
   * @returns Row element.
   */
  private rowElementCreate(row: ObjectPropertiesKeyvalueRawRow): HTMLElement {
    const caption = this.captionOf(row);
    const input = new InputText(caption);
    const shown: ObjectPropertiesKeyvalueRawRowShown = { input, row };
    input.bindCommit(() => shown.row.commit(input.getValue()));
    this.shownByKey.set(row.key, shown);
    const element = panelPropertiesRowCreate(caption, input);
    element.dataset['keyvalueKey'] = row.key;
    panelPropertiesRowMark(element, caption, row.helpText);
    return element;
  }

  /**
   * Shows the values of one keyvalue and binds its latest commit.
   *
   * @param row Keyvalue.
   */
  private rowValuesWrite(row: ObjectPropertiesKeyvalueRawRow): void {
    const shown = this.shownByKey.get(row.key);
    if (!shown) {
      return;
    }
    shown.row = row;
    if (shown.input.getElement().ownerDocument.activeElement !== shown.input.getElement()) {
      shown.input.setSharedValues(row.valueTexts);
    }
  }
}
