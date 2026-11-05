import { InputNumeric } from '@/ui/input/input_numeric.js';
import { InputSelect } from '@/ui/input/input_select.js';
import { buttonCompactCreate } from '@/ui/button/button_compact.js';
import { getStateFaceEditSession } from '@/texture/paint/state_face_edit_session.js';
import {
  getStateDisplacementSculpt,
  type DisplacementSculptSettings,
} from '@/displacement/state/state_displacement_sculpt.js';
import { DISPLACEMENT_POWERS } from '@/displacement/model/displacement_types.js';
import type {
  ControllerDisplacementActions,
  DisplacementActionResult,
} from '@/displacement/controller/controller_displacement_actions.js';
import { PanelDisplacementSection } from './panel_displacement_section.js';
import {
  displacementTabCaptionCreate,
  displacementTabFieldLabelCreate,
  displacementTabRowCreate,
} from './panel_displacement_tab_layout.js';

/** Runs one displacement action on the selected faces. */
export type PanelDisplacementActionRun = (
  action: (actions: ControllerDisplacementActions) => DisplacementActionResult,
) => void;

/** Height in pixels of the Displacement tab action buttons. */
const DISPLACEMENT_ACTION_BUTTON_HEIGHT_PX = 22;

/**
 * Displacement tab buttons and fields that change the selected faces at once:
 * Create with a power, Destroy, Subdivide, Invert Alpha, Sew, Smooth, Noise
 * with its seed, Elevation and Scale.
 */
export class PanelDisplacementActionsSection extends PanelDisplacementSection {
  private readonly powerSelect = new InputSelect(
    DISPLACEMENT_POWERS.map((power) => ({ value: String(power), label: `Power ${power}` })),
    'Displacement power',
  );
  private readonly noiseMinInput = this.numericInputOwn(new InputNumeric({ ariaLabel: 'Noise min', width: '56px' }));
  private readonly noiseMaxInput = this.numericInputOwn(new InputNumeric({ ariaLabel: 'Noise max', width: '56px' }));
  private readonly noiseSeedInput = this.numericInputOwn(new InputNumeric({ ariaLabel: 'Noise seed', width: '48px' }));
  private readonly elevationInput = this.numericInputOwn(new InputNumeric({ ariaLabel: 'Elevation', width: '56px' }));
  private readonly scaleInput = this.numericInputOwn(new InputNumeric({ ariaLabel: 'Scale', width: '56px' }));
  private readonly unsubscribeSession: () => void;

  /**
   * Builds the action controls.
   *
   * @param actionRun Runs an action on the selected faces.
   */
  constructor(private readonly actionRun: PanelDisplacementActionRun) {
    super();
    this.element.append(this.createRowBuild(), this.toolsRowBuild(), this.noiseRowBuild(), this.surfaceRowBuild());
    this.commitHandlersBind();
    this.unsubscribeSession = getStateFaceEditSession().changeListenerAdd(() => this.noiseSeedShow());
    this.noiseSeedShow();
  }

  /**
   * Shows the power and noise settings in the fields.
   *
   * @param settings Current displacement sculpt settings.
   */
  settingsShow(settings: Readonly<DisplacementSculptSettings>): void {
    this.powerSelect.setSharedValues([String(settings.power)]);
    this.noiseMinInput.setNumber(settings.noiseMin, 2);
    this.noiseMaxInput.setNumber(settings.noiseMax, 2);
  }

  /** Removes the session listener and the field listeners. */
  override dispose(): void {
    this.unsubscribeSession();
    super.dispose();
  }

  /**
   * Creates one action button.
   *
   * @param label Button text.
   * @param onClick Click handler.
   * @returns Button element.
   */
  private actionButtonCreate(label: string, onClick: () => void): HTMLButtonElement {
    return buttonCompactCreate({
      title: label,
      text: label,
      widthPx: null,
      heightPx: DISPLACEMENT_ACTION_BUTTON_HEIGHT_PX,
      onClick,
    });
  }

  /**
   * Builds the Power, Create and Destroy row.
   *
   * @returns Row element.
   */
  private createRowBuild(): HTMLElement {
    return displacementTabRowCreate([
      this.powerSelect.getElement(),
      this.actionButtonCreate('Create', () =>
        this.actionRun((actions) => actions.create(getStateDisplacementSculpt().settingsRead().power)),
      ),
      this.actionButtonCreate('Destroy', () => this.actionRun((actions) => actions.destroy())),
    ]);
  }

  /**
   * Builds the Subdivide, Invert Alpha, Sew and Smooth row.
   *
   * @returns Row element.
   */
  private toolsRowBuild(): HTMLElement {
    return displacementTabRowCreate([
      this.actionButtonCreate('Subdivide', () => this.actionRun((actions) => actions.subdivide())),
      this.actionButtonCreate('Invert Alpha', () => this.actionRun((actions) => actions.invertAlpha())),
      this.actionButtonCreate('Sew', () => this.actionRun((actions) => actions.sew())),
      this.actionButtonCreate('Smooth', () => this.actionRun((actions) => actions.smooth())),
    ]);
  }

  /**
   * Builds the Noise row with its min and max distances and its seed.
   *
   * @returns Container with caption and row.
   */
  private noiseRowBuild(): HTMLElement {
    const container = document.createElement('div');
    container.append(
      displacementTabCaptionCreate('Noise'),
      displacementTabRowCreate([
        displacementTabFieldLabelCreate('Min'),
        this.noiseMinInput.getElement(),
        displacementTabFieldLabelCreate('Max'),
        this.noiseMaxInput.getElement(),
        displacementTabFieldLabelCreate('Seed'),
        this.noiseSeedInput.getElement(),
        this.actionButtonCreate('Apply Noise', () => this.noiseApply()),
      ]),
    );
    return container;
  }

  /**
   * Builds the Elevation and Scale row.
   *
   * @returns Row element.
   */
  private surfaceRowBuild(): HTMLElement {
    return displacementTabRowCreate([
      displacementTabFieldLabelCreate('Elevation'),
      this.elevationInput.getElement(),
      displacementTabFieldLabelCreate('Scale'),
      this.scaleInput.getElement(),
    ]);
  }

  /** Binds the power, noise, seed, elevation and scale fields. */
  private commitHandlersBind(): void {
    this.powerSelect.bindCommit(() => this.powerCommit());
    this.noiseMinInput.bindCommit(() => this.noiseRangeCommit());
    this.noiseMaxInput.bindCommit(() => this.noiseRangeCommit());
    this.noiseSeedInput.bindCommit(() => this.noiseSeedCommit());
    this.elevationInput.bindCommit(() =>
      this.numericActionRun(this.elevationInput, (actions, value) => actions.elevationSet(value)),
    );
    this.scaleInput.bindCommit(() =>
      this.numericActionRun(this.scaleInput, (actions, value) => actions.scaleSet(value)),
    );
  }

  /** Stores the chosen power when it is a valid power. */
  private powerCommit(): void {
    const power = DISPLACEMENT_POWERS.find((entry) => String(entry) === this.powerSelect.getValue());
    if (power !== undefined) {
      getStateDisplacementSculpt().settingsWrite({ power });
    }
  }

  /**
   * Stores the typed noise range, or shows the stored one when a field is
   * invalid.
   */
  private noiseRangeCommit(): void {
    const noiseMin = this.noiseMinInput.parseNumberOrNull();
    const noiseMax = this.noiseMaxInput.parseNumberOrNull();
    if (noiseMin === null || noiseMax === null) {
      this.settingsShow(getStateDisplacementSculpt().settingsRead());
      return;
    }
    getStateDisplacementSculpt().settingsWrite({ noiseMin, noiseMax });
  }

  /** Stores the typed noise seed in the session, then shows the stored seed. */
  private noiseSeedCommit(): void {
    const seed = this.noiseSeedInput.parseNumberOrNull();
    if (seed !== null) {
      getStateFaceEditSession().displacementNoiseSeedWrite(seed);
    }
    this.noiseSeedShow();
  }

  /** Shows the session's noise seed in the Seed field. */
  private noiseSeedShow(): void {
    this.noiseSeedInput.setNumber(getStateFaceEditSession().displacementNoiseSeedRead(), 0);
  }

  /** Adds noise in the stored range with the session's seed. */
  private noiseApply(): void {
    const settings = getStateDisplacementSculpt().settingsRead();
    const seed = getStateFaceEditSession().displacementNoiseSeedRead();
    this.actionRun((actions) => actions.noise(settings.noiseMin, settings.noiseMax, seed));
  }

  /**
   * Runs an action with the number typed into a field when it parses.
   *
   * @param input Numeric field.
   * @param action Action receiving the typed number.
   */
  private numericActionRun(
    input: InputNumeric,
    action: (actions: ControllerDisplacementActions, value: number) => DisplacementActionResult,
  ): void {
    const value = input.parseNumberOrNull();
    if (value !== null) {
      this.actionRun((actions) => action(actions, value));
    }
  }
}
