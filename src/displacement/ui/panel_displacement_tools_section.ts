import {
  buttonCompactActiveWrite,
  buttonCompactCreate,
  buttonCompactEnabledWrite,
} from '@/ui/button/button_compact.js';
import {
  getStateDisplacementSculpt,
  type DisplacementSculptSettings,
} from '@/displacement/state/state_displacement_sculpt.js';
import type { DisplacementActiveTool } from '@/displacement/model/displacement_types.js';
import type {
  ControllerDisplacementActions,
  DisplacementSelectionSummary,
} from '@/displacement/controller/controller_displacement_actions.js';
import { PanelDisplacementSection, type PanelDisplacementActionRun } from './panel_displacement_section.js';
import { formLayoutGridEqualColumnsCreate } from '@/ui/form/form_layout.js';

/** What the selection must hold for a Tools button to be enabled. */
type PanelDisplacementToolRequirement = 'nothing' | 'faces' | 'displaced';

/** Number of columns of the Tools button grid. */
export const PANEL_DISPLACEMENT_TOOLS_COLUMN_COUNT = 5;

/**
 * Height in pixels of every Tools grid button, tall enough for a label wrapped
 * onto two lines.
 */
export const PANEL_DISPLACEMENT_TOOLS_BUTTON_HEIGHT_PX = 32;

/**
 * Hammer++ style Tools group of the Displacement tab: the Select, Paint
 * Geometry and Paint Alpha viewport tool toggles, and the Invert Alpha, Create,
 * Destroy, Subdivide, Noise and Sew buttons in a five-column grid of equally
 * sized buttons whose long labels wrap onto two centered lines. Buttons that
 * need faces or displaced faces are disabled while the selection has none.
 */
export class PanelDisplacementToolsSection extends PanelDisplacementSection {
  private readonly requirements = new Map<HTMLButtonElement, PanelDisplacementToolRequirement>();
  private readonly toolButtons = new Map<DisplacementActiveTool, HTMLButtonElement>();

  /**
   * Builds the Tools grid.
   *
   * @param actionRun Runs an action on the selected faces.
   * @param noiseDialogOpen Opens the Noise window.
   */
  constructor(
    private readonly actionRun: PanelDisplacementActionRun,
    private readonly noiseDialogOpen: () => void,
  ) {
    super('Tools', 'panel-displacement-tools');
    this.element.append(
      formLayoutGridEqualColumnsCreate(PANEL_DISPLACEMENT_TOOLS_COLUMN_COUNT, [
        ...this.toolRowButtonsCreate(),
        null,
        ...this.actionRowButtonsCreate(),
      ]),
    );
  }

  /**
   * Highlights the toggle of the active viewport tool.
   *
   * @param settings Current displacement sculpt settings.
   */
  override settingsShow(settings: Readonly<DisplacementSculptSettings>): void {
    this.toolButtons.forEach((button, tool) => {
      const isActive = settings.activeTool === tool;
      buttonCompactActiveWrite(button, isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
  }

  /**
   * Enables the buttons the selected faces allow.
   *
   * @param actions Installed actions over the selected faces, or null.
   */
  override selectionShow(actions: ControllerDisplacementActions | null): void {
    const summary = actions?.selectionSummaryRead() ?? null;
    this.requirements.forEach((requirement, button) => {
      buttonCompactEnabledWrite(button, PanelDisplacementToolsSection.requirementMet(requirement, summary));
    });
  }

  /**
   * Returns whether a selection satisfies a button requirement.
   *
   * @param requirement What the selection must hold.
   * @param summary Selected face counts, or null when no actions are installed.
   * @returns True when the button may be used.
   */
  private static requirementMet(
    requirement: PanelDisplacementToolRequirement,
    summary: DisplacementSelectionSummary | null,
  ): boolean {
    if (requirement === 'nothing') {
      return true;
    }
    const count = requirement === 'faces' ? summary?.faceCount : summary?.displacedCount;
    return (count ?? 0) > 0;
  }

  /**
   * Creates the first grid row: the tool toggles and Invert Alpha.
   *
   * @returns Row buttons.
   */
  private toolRowButtonsCreate(): HTMLButtonElement[] {
    return [
      this.toolToggleCreate('Select', 'select', 'nothing'),
      this.toolToggleCreate('Paint Geometry', 'paint_geometry', 'displaced'),
      this.toolToggleCreate('Paint Alpha', 'paint_alpha', 'displaced'),
      this.buttonCreate('Invert Alpha', 'displaced', () => this.actionRun((actions) => actions.invertAlpha())),
    ];
  }

  /**
   * Creates the second grid row: Create, Destroy, Subdivide, Noise and Sew.
   *
   * @returns Row buttons.
   */
  private actionRowButtonsCreate(): HTMLButtonElement[] {
    return [
      this.buttonCreate('Create', 'faces', () =>
        this.actionRun((actions) => actions.create(getStateDisplacementSculpt().settingsRead().power)),
      ),
      this.buttonCreate('Destroy', 'displaced', () => this.actionRun((actions) => actions.destroy())),
      this.buttonCreate('Subdivide', 'displaced', () => this.actionRun((actions) => actions.subdivide())),
      this.buttonCreate('Noise', 'displaced', () => this.noiseDialogOpen()),
      this.buttonCreate('Sew', 'displaced', () => this.actionRun((actions) => actions.sew())),
    ];
  }

  /**
   * Creates a viewport tool toggle. Clicking the active paint tool returns to
   * Select.
   *
   * @param label Button text.
   * @param tool Viewport tool the toggle activates.
   * @param requirement What the selection must hold.
   * @returns Toggle button.
   */
  private toolToggleCreate(
    label: string,
    tool: DisplacementActiveTool,
    requirement: PanelDisplacementToolRequirement,
  ): HTMLButtonElement {
    const button = this.buttonCreate(label, requirement, () => {
      const isActive = getStateDisplacementSculpt().settingsRead().activeTool === tool;
      getStateDisplacementSculpt().settingsWrite({ activeTool: isActive ? 'select' : tool });
    });
    this.toolButtons.set(tool, button);
    return button;
  }

  /**
   * Creates one grid button and records its requirement.
   *
   * @param label Button text.
   * @param requirement What the selection must hold.
   * @param onClick Click handler.
   * @returns Button element.
   */
  private buttonCreate(
    label: string,
    requirement: PanelDisplacementToolRequirement,
    onClick: () => void,
  ): HTMLButtonElement {
    const button = buttonCompactCreate({
      title: label,
      text: label,
      widthPx: null,
      heightPx: PANEL_DISPLACEMENT_TOOLS_BUTTON_HEIGHT_PX,
      isTextWrapping: true,
      onClick,
    });
    button.style.width = '100%';
    button.style.padding = '0 2px';
    this.requirements.set(button, requirement);
    return button;
  }
}
