import { InputSelect, type InputSelectChoice } from '@/ui/input/input_select.js';
import { InputSlider } from '@/ui/input/input_slider.js';
import { InputCheckbox } from '@/ui/input/input_checkbox.js';
import { faceEditSheetCheckboxLabelCreate } from '@/texture/ui/face_edit_sheet/widgets/face_edit_sheet_widget_checkbox_label.js';
import { getStateSprinkleTool } from '@/tools/sprinkle/state_sprinkle_tool.js';
import {
  SPRINKLE_PLACEMENT_MODES,
  type SprinkleConfig,
  type SprinklePlacementMode,
} from '@/tools/sprinkle/sprinkle_types.js';
import { SprinkleControls } from './sprinkle_controls.js';

/** Visible names of the Sprinkle placement modes. */
const SPRINKLE_CONTROLS_PLACEMENT_MODE_LABELS: Readonly<Record<SprinklePlacementMode, string>> = Object.freeze({
  ADDITIVE: 'Additive',
  SUBTRACTIVE: 'Subtractive',
  REPLACE: 'Replace',
  OVERWRITE: 'Overwrite',
});

/** Hover text of the Sprinkle placement modes. */
const SPRINKLE_CONTROLS_PLACEMENT_MODE_TITLES: Readonly<Record<SprinklePlacementMode, string>> = Object.freeze({
  ADDITIVE: 'Adds entities in the radius, overwriting sprinkled entities in the cells it places into',
  SUBTRACTIVE: 'Removes sprinkled entities in the radius',
  REPLACE: 'Removes all sprinkled entities in the radius, then adds like Additive',
  OVERWRITE: 'Adds like Additive, but only in cells that already hold a sprinkled entity',
});

/**
 * Placement controls of the Entity Sprinkle window: Mode, Density, Random Yaw
 * and Align to Normal.
 */
export class SprinkleControlsPlacement extends SprinkleControls {
  /** Placement mode list. */
  readonly modeSelect = new InputSelect(SprinkleControlsPlacement.modeChoicesRead(), 'Sprinkle mode');
  /** Density percent slider. */
  readonly densitySlider = new InputSlider({ ariaLabel: 'Sprinkle density', min: 0, max: 100, step: 1, decimals: 0 });
  /** Random yaw toggle. */
  readonly randomYawCheckbox = new InputCheckbox('Random Yaw');
  /** Align to normal toggle. */
  readonly alignToNormalCheckbox = new InputCheckbox('Align to Normal');
  /** Random yaw toggle with its caption. */
  readonly randomYawLabel = faceEditSheetCheckboxLabelCreate(this.randomYawCheckbox, 'Random Yaw');
  /** Align to normal toggle with its caption. */
  readonly alignToNormalLabel = faceEditSheetCheckboxLabelCreate(this.alignToNormalCheckbox, 'Align to Normal');

  /** Creates the placement controls and binds their commits. */
  constructor() {
    super();
    const tool = getStateSprinkleTool();
    this.modeSelect.bindCommit(() => this.modeCommit());
    this.densitySlider.bindCommit(() => this.densityCommit());
    this.randomYawCheckbox.bindCommit(() => tool.configPatch({ randomYaw: this.randomYawCheckbox.getValue() }));
    this.alignToNormalCheckbox.bindCommit(() =>
      tool.configPatch({ alignToNormal: this.alignToNormalCheckbox.getValue() }),
    );
    this.disposerAdd(() => this.modeSelect.dispose());
    this.disposerAdd(() => this.densitySlider.dispose());
  }

  /**
   * Lists the placement modes as select entries.
   *
   * @returns Mode entries in window order.
   */
  static modeChoicesRead(): InputSelectChoice[] {
    return SPRINKLE_PLACEMENT_MODES.map((mode) => ({
      value: mode,
      label: SPRINKLE_CONTROLS_PLACEMENT_MODE_LABELS[mode],
      title: SPRINKLE_CONTROLS_PLACEMENT_MODE_TITLES[mode],
    }));
  }

  /**
   * Shows the mode, density and orientation toggles.
   *
   * @param config Current Sprinkle tool configuration.
   */
  configShow(config: Readonly<SprinkleConfig>): void {
    this.modeSelect.setSharedValues([config.mode]);
    this.densitySlider.setNumber(config.densityPercent);
    this.randomYawCheckbox.setSharedValues([config.randomYaw]);
    this.alignToNormalCheckbox.setSharedValues([config.alignToNormal]);
  }

  /** Stores the chosen placement mode. */
  private modeCommit(): void {
    const chosenValue = this.modeSelect.getValue();
    const mode = SPRINKLE_PLACEMENT_MODES.find((candidate) => candidate === chosenValue);
    if (mode) {
      getStateSprinkleTool().configPatch({ mode });
    }
  }

  /** Stores the density, or shows the stored one when the box holds none. */
  private densityCommit(): void {
    const densityPercent = this.densitySlider.getValue();
    if (densityPercent === null) {
      this.configShowCurrent();
      return;
    }
    getStateSprinkleTool().configPatch({ densityPercent });
  }
}
