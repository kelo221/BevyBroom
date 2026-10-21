import { Theme } from '@/theme.js';
import { hexToRgb } from '@/utils/utils_color.js';
import type { FaceAttributesEditor } from '@/texture/ui/face_attributes/face_attributes_editor.js';
import type { MaterialBrowser } from '@/texture/ui/material_browser/material_browser.js';

/** Source that pushes the current selection's face attributes into the view. */
export interface FaceInspectorSelectionSource {
  /** Shows the current selection's face attribute values in its view. */
  refreshFromSelection(): void;
}

/** Parts the face inspector stacks into one column. */
export interface FaceInspectorParts {
  faceAttributesEditor: FaceAttributesEditor;
  materialBrowser: MaterialBrowser;
  selectionSource: FaceInspectorSelectionSource;
}

/**
 * Face tab column: face attributes at their natural height on top and the
 * material browser filling the rest below. Selection refreshes only run while
 * the inspector is visible; becoming visible refreshes once.
 */
export class FaceInspector {
  private readonly element: HTMLElement;
  private readonly parts: FaceInspectorParts;
  private visible: boolean;

  /**
   * Creates the face inspector column.
   *
   * @param parts Attributes editor, material browser and selection source.
   */
  constructor(parts: FaceInspectorParts) {
    this.parts = parts;
    this.visible = true;
    this.element = document.createElement('div');
    this.columnStyleApply();
    this.attributesSlotAppend();
    this.element.appendChild(parts.materialBrowser.getElement());
  }

  /**
   * Returns the inspector column element.
   *
   * @returns Column DOM node.
   */
  getElement(): HTMLElement {
    return this.element;
  }

  /**
   * Returns the face attributes editor at the top of the column.
   *
   * @returns Face attributes editor.
   */
  getFaceAttributesEditor(): FaceAttributesEditor {
    return this.parts.faceAttributesEditor;
  }

  /**
   * Returns the material browser below the attributes.
   *
   * @returns Material browser.
   */
  getMaterialBrowser(): MaterialBrowser {
    return this.parts.materialBrowser;
  }

  /** Refreshes the face attributes from the selection while visible. */
  refreshFromSelection(): void {
    if (!this.visible) {
      return;
    }
    this.parts.selectionSource.refreshFromSelection();
  }

  /**
   * Shows or hides the column; showing it refreshes from the selection.
   *
   * @param visible Whether the Face tab is shown.
   */
  setVisible(visible: boolean): void {
    this.visible = visible;
    this.element.style.display = visible ? 'flex' : 'none';
    this.refreshFromSelection();
  }

  /**
   * Returns whether the column is shown.
   *
   * @returns True while visible.
   */
  isVisible(): boolean {
    return this.visible;
  }

  /** Disposes both parts and detaches the column. */
  dispose(): void {
    this.parts.faceAttributesEditor.dispose();
    this.parts.materialBrowser.dispose();
    this.element.remove();
  }

  /** Lays the column out to fill its parent with a flexible lower half. */
  private columnStyleApply(): void {
    this.element.dataset['faceInspector'] = 'true';
    this.element.style.display = 'flex';
    this.element.style.flexDirection = 'column';
    this.element.style.width = '100%';
    this.element.style.height = '100%';
    this.element.style.minHeight = '0';
    this.element.style.boxSizing = 'border-box';
    this.element.style.overflow = 'hidden';
    this.element.style.background = hexToRgb(Theme.outlinerBackground);
    this.element.style.color = Theme.buttonTextColor;
  }

  /** Appends the attributes editor so it keeps its natural height. */
  private attributesSlotAppend(): void {
    const attributesElement = this.parts.faceAttributesEditor.getElement();
    attributesElement.style.flex = '0 0 auto';
    this.element.appendChild(attributesElement);
  }
}
