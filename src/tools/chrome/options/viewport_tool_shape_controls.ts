import { ViewportToolShapeDropdown } from './viewport_tool_shape_dropdown.js';
import { ViewportToolShapeParameters } from './viewport_tool_shape_parameters.js';
import { getShapeDrawSettings } from '@/tools/shape_draw/shapes/shape_draw_settings.js';

/**
 * Options bar cluster of the draw tool shape picker: the Shape dropdown and the
 * parameter fields of the selected shape.
 */
export class ViewportToolShapeControls {
  private readonly dropdown: ViewportToolShapeDropdown;
  private readonly parameters: ViewportToolShapeParameters;
  private readonly root: HTMLElement;

  /**
   * Creates the shape cluster.
   *
   * @param parentElement Options bar host used to resolve the document.
   * @param onSettingChanged Invoked after the shape selection or a parameter
   *   changed.
   */
  constructor(parentElement: HTMLElement, onSettingChanged: () => void) {
    this.dropdown = new ViewportToolShapeDropdown(parentElement, getShapeDrawSettings(), () => {
      this.shapeChosenHandle(onSettingChanged);
    });
    this.parameters = new ViewportToolShapeParameters(parentElement, getShapeDrawSettings(), onSettingChanged);
    this.root = this.rootCreate(parentElement);
  }

  /**
   * Returns the cluster element.
   *
   * @returns Root element.
   */
  getElement(): HTMLElement {
    return this.root;
  }

  /** Refreshes the trigger icon after the selected shape changed. */
  selectionRefresh(): void {
    this.dropdown.selectionRefresh();
  }

  /** Disposes the dropdown and removes the cluster from the DOM. */
  dispose(): void {
    this.dropdown.dispose();
    this.root.remove();
  }

  /**
   * Builds the cluster root holding the dropdown and parameter fields.
   *
   * @param parentElement Host used to resolve the document.
   * @returns Root element with both controls attached.
   */
  private rootCreate(parentElement: HTMLElement): HTMLElement {
    const root = parentElement.ownerDocument.createElement('div');
    root.style.display = 'flex';
    root.style.alignItems = 'center';
    root.style.gap = '4px';
    root.appendChild(this.dropdown.getElement());
    root.appendChild(this.parameters.getElement());
    return root;
  }

  /**
   * Applies a shape picked in the dropdown and notifies the host.
   *
   * @param onSettingChanged Host notification invoked after the refresh.
   */
  private shapeChosenHandle(onSettingChanged: () => void): void {
    this.dropdown.selectionRefresh();
    this.parameters.rebuild();
    onSettingChanged();
  }
}
