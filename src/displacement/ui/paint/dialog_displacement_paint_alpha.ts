import { InputSlider } from '@/ui/input/input_slider.js';
import { faceEditSheetGroupBoxCreate } from '@/texture/ui/face_edit_sheet/widgets/face_edit_sheet_widget_group_box.js';
import { faceEditSheetCheckboxLabelCreate } from '@/texture/ui/face_edit_sheet/widgets/face_edit_sheet_widget_checkbox_label.js';
import {
  getStateDisplacementSculpt,
  type DisplacementSculptSettings,
} from '@/displacement/state/state_displacement_sculpt.js';
import { DISPLACEMENT_ALPHA_MAX } from '@/displacement/model/displacement_types.js';
import { DialogDisplacementPaintBase } from './dialog_displacement_paint_base.js';

/**
 * Hammer++ style Displacement Paint Alpha window: the alpha value dabs paint
 * towards, the Radius slider with Spatial, and the Soft-Edge / Hard-Edge brush.
 * Opens while Paint Alpha is the active viewport tool.
 */
export class DialogDisplacementPaintAlpha extends DialogDisplacementPaintBase {
  private readonly alphaSlider = new InputSlider({
    ariaLabel: 'Paint alpha',
    min: 0,
    max: DISPLACEMENT_ALPHA_MAX,
    step: 1,
    decimals: 0,
  });

  /**
   * Creates the Paint Alpha window, hidden.
   *
   * @param host Parent element hosting floating panels.
   */
  constructor(host: HTMLElement) {
    super(host, 'paint_alpha', 'Displacement Paint Alpha', 'dialog-displacement-paint-alpha');
    this.alphaSlider.bindCommit(() => this.alphaCommit());
    this.disposerAdd(() => this.alphaSlider.dispose());
    this.contentMount([
      faceEditSheetGroupBoxCreate('Alpha', 'dialog-displacement-paint-alpha-value', this.alphaSlider.getElement()),
      faceEditSheetGroupBoxCreate(
        'Spatial',
        'dialog-displacement-paint-spatial',
        this.radiusSlider.getElement(),
        faceEditSheetCheckboxLabelCreate(this.spatialCheckbox, 'Spatial'),
      ),
      faceEditSheetGroupBoxCreate('Brush', 'dialog-displacement-paint-brush', this.edgeRadio.getElement()),
    ]);
  }

  /**
   * Returns the viewport mouse bindings of Paint Alpha.
   *
   * @returns Status bar hint text.
   */
  bindingHintRead(): string {
    return 'Paint Alpha: LMB paint alpha · RMB or Ctrl paint toward 0 · Shift+RMB drag resize brush';
  }

  /**
   * Shows the alpha value.
   *
   * @param settings Current displacement sculpt settings.
   */
  protected toolSettingsShow(settings: Readonly<DisplacementSculptSettings>): void {
    this.alphaSlider.setNumber(settings.alphaValue);
  }

  /**
   * Stores the shown alpha value, or shows the stored one when the slider holds
   * none.
   */
  private alphaCommit(): void {
    const alphaValue = this.alphaSlider.getValue();
    if (alphaValue === null) {
      this.toolSettingsShow(getStateDisplacementSculpt().settingsRead());
      return;
    }
    getStateDisplacementSculpt().settingsWrite({ alphaValue });
  }
}
