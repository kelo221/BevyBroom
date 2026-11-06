import { InputNumeric } from '@/ui/input/input_numeric.js';
import { buttonCompactCreate } from '@/ui/button/button_compact.js';
import { getStateFaceEditSession } from '@/texture/paint/state_face_edit_session.js';
import { getStateDisplacementSculpt } from '@/displacement/state/state_displacement_sculpt.js';
import { DialogDisplacementFloating } from '@/displacement/ui/dialog_displacement_floating.js';
import {
  PANEL_DISPLACEMENT_BUTTON_HEIGHT_PX,
  type PanelDisplacementActionRun,
} from '@/displacement/ui/panel_displacement_section.js';
import {
  displacementTabFieldLabelCreate,
  displacementTabRowCreate,
} from '@/displacement/ui/panel_displacement_tab_layout.js';

/**
 * Floating Noise window of the Displacement tab: the smallest and largest
 * distance Noise adds and the random seed, and Apply adding seeded noise to the
 * selected displaced faces as one undo step.
 */
export class DialogDisplacementNoise extends DialogDisplacementFloating {
  private readonly minInput = new InputNumeric({ ariaLabel: 'Noise min', width: '64px' });
  private readonly maxInput = new InputNumeric({ ariaLabel: 'Noise max', width: '64px' });
  private readonly seedInput = new InputNumeric({ ariaLabel: 'Noise seed', width: '56px' });

  /**
   * Creates the Noise window, hidden.
   *
   * @param host Parent element hosting floating panels.
   * @param actionRun Runs an action on the selected faces.
   */
  constructor(
    host: HTMLElement,
    private readonly actionRun: PanelDisplacementActionRun,
  ) {
    super(host, {
      titleText: 'Noise',
      className: 'dialog-displacement-noise',
      width: '260px',
      floating: { centered: true, draggable: true, closeOnEscape: true },
    });
    this.body.append(this.fieldsRowBuild(), this.applyRowBuild());
    this.commitHandlersBind();
    this.listenersBind();
    this.valuesShow();
  }

  /** Binds the range and seed fields. */
  private commitHandlersBind(): void {
    this.minInput.bindCommit(() => this.rangeCommit());
    this.maxInput.bindCommit(() => this.rangeCommit());
    this.seedInput.bindCommit(() => this.seedCommit());
    this.disposerAdd(() => [this.minInput, this.maxInput, this.seedInput].forEach((input) => input.dispose()));
  }

  /** Shows range and seed changes made elsewhere. */
  private listenersBind(): void {
    this.disposerAdd(getStateDisplacementSculpt().changeListenerAdd(() => this.valuesShow()));
    this.disposerAdd(getStateFaceEditSession().changeListenerAdd(() => this.valuesShow()));
  }

  /** Shows the stored noise range and the session's seed. */
  private valuesShow(): void {
    const settings = getStateDisplacementSculpt().settingsRead();
    this.minInput.setNumber(settings.noiseMin, 2);
    this.maxInput.setNumber(settings.noiseMax, 2);
    this.seedInput.setNumber(getStateFaceEditSession().displacementNoiseSeedRead(), 0);
  }

  /**
   * Stores the typed noise range, or shows the stored one when a field is
   * invalid.
   */
  private rangeCommit(): void {
    const noiseMin = this.minInput.parseNumberOrNull();
    const noiseMax = this.maxInput.parseNumberOrNull();
    if (noiseMin === null || noiseMax === null) {
      this.valuesShow();
      return;
    }
    getStateDisplacementSculpt().settingsWrite({ noiseMin, noiseMax });
  }

  /** Stores the typed seed in the session, then shows the stored seed. */
  private seedCommit(): void {
    const seed = this.seedInput.parseNumberOrNull();
    if (seed !== null) {
      getStateFaceEditSession().displacementNoiseSeedWrite(seed);
    }
    this.valuesShow();
  }

  /** Adds noise in the stored range with the session's seed. */
  private noiseApply(): void {
    const settings = getStateDisplacementSculpt().settingsRead();
    const seed = getStateFaceEditSession().displacementNoiseSeedRead();
    this.actionRun((actions) => actions.noise(settings.noiseMin, settings.noiseMax, seed));
  }

  /**
   * Builds the Min, Max and Seed row.
   *
   * @returns Row element.
   */
  private fieldsRowBuild(): HTMLElement {
    return displacementTabRowCreate([
      displacementTabFieldLabelCreate('Min'),
      this.minInput.getElement(),
      displacementTabFieldLabelCreate('Max'),
      this.maxInput.getElement(),
      displacementTabFieldLabelCreate('Seed'),
      this.seedInput.getElement(),
    ]);
  }

  /**
   * Builds the row holding the Apply button.
   *
   * @returns Row element.
   */
  private applyRowBuild(): HTMLElement {
    return displacementTabRowCreate([
      buttonCompactCreate({
        title: 'Apply Noise',
        text: 'Apply',
        widthPx: null,
        heightPx: PANEL_DISPLACEMENT_BUTTON_HEIGHT_PX,
        onClick: () => this.noiseApply(),
      }),
    ]);
  }
}
