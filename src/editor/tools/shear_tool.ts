import { TransformMode } from '@/types/transform_mode.js';
import { BoxSelectTool } from './box_select_tool.js';
import { BoundsWidget } from '../widgets/bounds_widget.js';

/**
 * Permanent shear tool: object selection via the box-select base with the
 * bounds widget shown, so dragging a bounds side shears the selection.
 */
export class ShearTool extends BoxSelectTool {
  private readonly boundsWidget: BoundsWidget;

  /** Creates a shear tool. */
  constructor() {
    super();
    this.boundsWidget = new BoundsWidget();
  }

  /** Called when the tool is activated. */
  override onActivate(): void {
    super.onActivate();
    this.activateShearWidgetPath();
  }

  /** Called when the tool is rendered. */
  override onRender(): void {
    super.onRender();
    this.updateBoundsWidgetVisibility();
  }

  /** Shear path: bounds widget handles with the shear drag behavior. */
  private activateShearWidgetPath(): void {
    const services = this.editor?.getServices();
    if (!services || !this.editor) {
      return;
    }
    services.setWidgetMode(TransformMode.SHEAR);
    services.refreshGizmoPresentation();
    services.setStatusMessage('Shear');
    this.editor.addWidget(this.boundsWidget);
    this.updateBoundsWidgetVisibility();
  }

  /** Shows the bounds widget when there is a selection. */
  private updateBoundsWidgetVisibility(): void {
    if (!this.editor) {
      return;
    }
    this.boundsWidget.visible = this.editor.selectedSegmentsCount > 0;
  }
}
