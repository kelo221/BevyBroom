import { InputCheckbox } from '@/ui/input/input_checkbox.js';
import { InputNumeric } from '@/ui/input/input_numeric.js';
import { InputSelect, type InputSelectChoice } from '@/ui/input/input_select.js';
import {
  getStateDisplacementSculpt,
  type DisplacementSculptSettings,
} from '@/displacement/state/state_displacement_sculpt.js';
import { DISPLACEMENT_SCULPT_TOOLS, type DisplacementSculptTool } from '@/displacement/model/displacement_types.js';
import { PanelDisplacementSection } from './panel_displacement_section.js';
import {
  displacementTabCaptionCreate,
  displacementTabCheckboxLabelCreate,
  displacementTabFieldLabelCreate,
  displacementTabRowCreate,
} from './panel_displacement_tab_layout.js';

/** Visible names of the sculpt tools. */
const DISPLACEMENT_SCULPT_TOOL_LABELS: Readonly<Record<DisplacementSculptTool, string>> = {
  raise_lower: 'Raise/Lower',
  smooth: 'Smooth',
  noise: 'Noise',
  flatten: 'Flatten',
};

/**
 * Paint Geometry controls of the Displacement tab: whether viewport drags
 * sculpt, the paint tool, the raise direction, the radius and the distance.
 */
export class PanelDisplacementPaintSection extends PanelDisplacementSection {
  private readonly paintCheckbox = new InputCheckbox('Paint Geometry');
  private readonly raiseCheckbox = new InputCheckbox('Raise');
  private readonly toolSelect = new InputSelect(PanelDisplacementPaintSection.toolChoicesBuild(), 'Paint tool');
  private readonly radiusInput = this.numericInputOwn(new InputNumeric({ ariaLabel: 'Paint radius', width: '56px' }));
  private readonly distanceInput = this.numericInputOwn(
    new InputNumeric({ ariaLabel: 'Paint distance', width: '56px' }),
  );

  /** Builds the paint controls and binds them to the shared settings. */
  constructor() {
    super();
    this.element.append(
      displacementTabCaptionCreate('Paint Geometry'),
      displacementTabRowCreate([
        displacementTabCheckboxLabelCreate(this.paintCheckbox.getElement(), 'Paint'),
        this.toolSelect.getElement(),
        displacementTabCheckboxLabelCreate(this.raiseCheckbox.getElement(), 'Raise'),
      ]),
      displacementTabRowCreate([
        displacementTabFieldLabelCreate('Radius'),
        this.radiusInput.getElement(),
        displacementTabFieldLabelCreate('Distance'),
        this.distanceInput.getElement(),
      ]),
    );
    this.commitHandlersBind();
  }

  /**
   * Shows the paint settings in the fields.
   *
   * @param settings Current displacement sculpt settings.
   */
  settingsShow(settings: Readonly<DisplacementSculptSettings>): void {
    this.paintCheckbox.setSharedValues([settings.paintEnabled]);
    this.raiseCheckbox.setSharedValues([settings.raise]);
    this.toolSelect.setSharedValues([settings.tool]);
    this.radiusInput.setNumber(settings.radius, 2);
    this.distanceInput.setNumber(settings.distance, 2);
  }

  /**
   * Builds the tool dropdown entries.
   *
   * @returns One entry per sculpt tool.
   */
  private static toolChoicesBuild(): InputSelectChoice[] {
    return DISPLACEMENT_SCULPT_TOOLS.map((tool) => ({ value: tool, label: DISPLACEMENT_SCULPT_TOOL_LABELS[tool] }));
  }

  /** Writes field changes into the shared settings. */
  private commitHandlersBind(): void {
    const state = getStateDisplacementSculpt();
    this.paintCheckbox.bindCommit(() => state.settingsWrite({ paintEnabled: this.paintCheckbox.getValue() }));
    this.raiseCheckbox.bindCommit(() => state.settingsWrite({ raise: this.raiseCheckbox.getValue() }));
    this.toolSelect.bindCommit(() => this.toolCommit());
    this.radiusInput.bindCommit(() => this.positiveSettingCommit(this.radiusInput, 'radius'));
    this.distanceInput.bindCommit(() => this.positiveSettingCommit(this.distanceInput, 'distance'));
  }

  /** Stores the chosen paint tool when it is a known tool. */
  private toolCommit(): void {
    const tool = DISPLACEMENT_SCULPT_TOOLS.find((entry) => entry === this.toolSelect.getValue());
    if (tool) {
      getStateDisplacementSculpt().settingsWrite({ tool });
    }
  }
}
