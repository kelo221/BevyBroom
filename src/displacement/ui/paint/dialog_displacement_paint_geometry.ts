import { InputCheckbox } from '@/ui/input/input_checkbox.js';
import { InputRadioGroup } from '@/ui/input/input_radio_group.js';
import { InputSelect } from '@/ui/input/input_select.js';
import { InputSlider } from '@/ui/input/input_slider.js';
import { faceEditSheetGroupBoxCreate } from '@/texture/ui/face_edit_sheet/widgets/face_edit_sheet_widget_group_box.js';
import { faceEditSheetCheckboxLabelCreate } from '@/texture/ui/face_edit_sheet/widgets/face_edit_sheet_widget_checkbox_label.js';
import {
  getStateDisplacementSculpt,
  type DisplacementSculptSettings,
} from '@/displacement/state/state_displacement_sculpt.js';
import {
  DISPLACEMENT_SCULPT_AXES,
  DISPLACEMENT_SCULPT_EFFECTS,
  type DisplacementSculptAxis,
  type DisplacementSculptEffect,
} from '@/displacement/model/displacement_types.js';
import { formLayoutFieldLabelCreate, formLayoutRowCreate } from '@/ui/form/form_layout.js';
import { DialogDisplacementPaintBase } from './dialog_displacement_paint_base.js';
import { keyboardHintFormat } from '@/settings/keyboard/keyboard_hint_format.js';

/** Visible names of the Paint Geometry effects. */
const DIALOG_DISPLACEMENT_EFFECT_LABELS: Readonly<Record<DisplacementSculptEffect, string>> = {
  raise_lower: 'Raise/Lower',
  raise_to: 'Raise To',
  smooth: 'Smooth',
  flatten: 'Flatten',
  noise: 'Noise',
};

/** Visible names of the paint axes. */
const DIALOG_DISPLACEMENT_AXIS_LABELS: Readonly<Record<DisplacementSculptAxis, string>> = {
  face_normal: 'Face Normal',
  x: 'X',
  y: 'Y',
  z: 'Z',
};

/**
 * Hammer++ style Displacement Paint Geometry window: the paint effect with
 * Raise and Spatial, the axis, the Soft-Edge / Hard-Edge brush, the Distance
 * and Radius sliders, AutoSew and Continuous Mouse. Opens while Paint Geometry
 * is the active viewport tool.
 */
export class DialogDisplacementPaintGeometry extends DialogDisplacementPaintBase {
  private readonly effectRadio = new InputRadioGroup(
    DISPLACEMENT_SCULPT_EFFECTS.map((effect) => ({ value: effect, label: DIALOG_DISPLACEMENT_EFFECT_LABELS[effect] })),
    'Paint effect',
  );
  private readonly raiseCheckbox = new InputCheckbox('Raise');
  private readonly axisSelect = new InputSelect(
    DISPLACEMENT_SCULPT_AXES.map((axis) => ({ value: axis, label: DIALOG_DISPLACEMENT_AXIS_LABELS[axis] })),
    'Paint axis',
  );
  private readonly distanceSlider = new InputSlider({
    ariaLabel: 'Paint distance',
    min: 0.001,
    max: 4,
    step: 0.001,
    decimals: 3,
  });
  private readonly autoSewCheckbox = new InputCheckbox('AutoSew');
  private readonly continuousMouseCheckbox = new InputCheckbox('Continuous Mouse');

  /**
   * Creates the Paint Geometry window, hidden.
   *
   * @param host Parent element hosting floating panels.
   */
  constructor(host: HTMLElement) {
    super(host, 'paint_geometry', 'Displacement Paint Geometry', 'dialog-displacement-paint-geometry');
    this.toolCommitHandlersBind();
    this.contentMount([
      this.effectGroupBuild(),
      formLayoutRowCreate([formLayoutFieldLabelCreate('Axis'), this.axisSelect.getElement()]),
      faceEditSheetGroupBoxCreate('Brush', 'dialog-displacement-paint-brush', this.edgeRadio.getElement()),
      faceEditSheetGroupBoxCreate('Distance', 'dialog-displacement-paint-distance', this.distanceSlider.getElement()),
      faceEditSheetGroupBoxCreate('Spatial', 'dialog-displacement-paint-spatial', this.radiusSlider.getElement()),
      formLayoutRowCreate([
        faceEditSheetCheckboxLabelCreate(this.autoSewCheckbox, 'AutoSew'),
        faceEditSheetCheckboxLabelCreate(this.continuousMouseCheckbox, 'Continuous Mouse'),
      ]),
    ]);
  }

  /**
   * Returns the viewport mouse bindings of Paint Geometry.
   *
   * @returns Status bar hint text.
   */
  bindingHintRead(): string {
    return keyboardHintFormat(
      'Paint Geometry: LMB paint · RMB or {control} invert · {shift} smooth · {shift}+RMB drag resize brush',
    );
  }

  /**
   * Shows the effect, raise, axis, distance, AutoSew and Continuous Mouse
   * settings.
   *
   * @param settings Current displacement sculpt settings.
   */
  protected toolSettingsShow(settings: Readonly<DisplacementSculptSettings>): void {
    this.effectRadio.setSharedValues([settings.effect]);
    this.raiseCheckbox.setSharedValues([settings.raise]);
    this.axisSelect.setSharedValues([settings.axis]);
    this.distanceSlider.setNumber(settings.distance);
    this.autoSewCheckbox.setSharedValues([settings.autoSew]);
    this.continuousMouseCheckbox.setSharedValues([settings.continuousMouse]);
  }

  /**
   * Builds the Effect group: the effect radios with Raise beside them and
   * Spatial below.
   *
   * @returns Group box element.
   */
  private effectGroupBuild(): HTMLElement {
    return faceEditSheetGroupBoxCreate(
      'Effect',
      'dialog-displacement-paint-effect',
      formLayoutRowCreate([
        this.effectRadio.getElement(),
        faceEditSheetCheckboxLabelCreate(this.raiseCheckbox, keyboardHintFormat('Raise ({control} lowers)')),
      ]),
      faceEditSheetCheckboxLabelCreate(this.spatialCheckbox, 'Spatial'),
    );
  }

  /** Writes changes of the Paint Geometry controls into the settings. */
  private toolCommitHandlersBind(): void {
    const state = getStateDisplacementSculpt();
    this.effectRadio.bindCommit(() => {
      const effect = this.effectRadio.getValue();
      if (effect) state.settingsWrite({ effect });
    });
    this.raiseCheckbox.bindCommit(() => state.settingsWrite({ raise: this.raiseCheckbox.getValue() }));
    this.axisSelect.bindCommit(() => this.axisCommit());
    this.distanceSlider.bindCommit(() => this.positiveSettingCommit(this.distanceSlider, 'distance'));
    this.autoSewCheckbox.bindCommit(() => state.settingsWrite({ autoSew: this.autoSewCheckbox.getValue() }));
    this.continuousMouseCheckbox.bindCommit(() =>
      state.settingsWrite({ continuousMouse: this.continuousMouseCheckbox.getValue() }),
    );
    this.disposerAdd(() =>
      [this.effectRadio, this.axisSelect, this.distanceSlider].forEach((input) => input.dispose()),
    );
  }

  /** Stores the chosen axis when it is a known axis. */
  private axisCommit(): void {
    const axis = DISPLACEMENT_SCULPT_AXES.find((entry) => entry === this.axisSelect.getValue());
    if (axis) {
      getStateDisplacementSculpt().settingsWrite({ axis });
    }
  }
}
