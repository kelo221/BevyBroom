import { InputCheckbox } from '@/ui/input/input_checkbox.js';
import { InputRadioGroup } from '@/ui/input/input_radio_group.js';
import { InputSlider } from '@/ui/input/input_slider.js';
import {
  DISPLACEMENT_SCULPT_RADIUS_MAX,
  DISPLACEMENT_SCULPT_RADIUS_MIN,
  getStateDisplacementSculpt,
  type DisplacementSculptSettings,
} from '@/displacement/state/state_displacement_sculpt.js';
import type { DisplacementPaintTool } from '@/displacement/model/displacement_types.js';
import { PanelFloatingToolWindow } from '@/ui/floating_panel/panel_floating_tool_window.js';

/** Settings entry a positive slider edits. */
export type DialogDisplacementPaintPositiveKey = 'radius' | 'distance';

/**
 * Floating paint window of one displacement paint tool. Holds the controls
 * every paint tool shares (Soft-Edge / Hard-Edge brush, Radius, Spatial), shows
 * the shared displacement sculpt settings and returns the viewport tool to
 * Select when it closes while its tool is active.
 */
export abstract class DialogDisplacementPaintBase extends PanelFloatingToolWindow {
  protected readonly edgeRadio = new InputRadioGroup(
    [
      { value: 'soft', label: 'Soft-Edge' },
      { value: 'hard', label: 'Hard-Edge' },
    ],
    'Brush edge',
    'row',
  );
  protected readonly radiusSlider = new InputSlider({
    ariaLabel: 'Paint radius',
    min: DISPLACEMENT_SCULPT_RADIUS_MIN,
    max: DISPLACEMENT_SCULPT_RADIUS_MAX,
    step: 0.01,
    decimals: 2,
  });
  protected readonly spatialCheckbox = new InputCheckbox('Spatial');

  /**
   * Creates the window shell and binds the shared controls.
   *
   * @param host Parent element hosting floating panels.
   * @param paintTool Paint tool the window configures.
   * @param titleText Title bar text.
   * @param className Class name of the window root.
   */
  protected constructor(
    host: HTMLElement,
    readonly paintTool: DisplacementPaintTool,
    titleText: string,
    className: string,
  ) {
    super(host, {
      titleText,
      className,
      width: '280px',
      floating: { corner: 'top-left', draggable: true, closeOnEscape: true },
    });
    this.sharedCommitHandlersBind();
  }

  /**
   * Shows the shared controls and the tool's own controls from the settings.
   *
   * @param settings Current displacement sculpt settings.
   */
  settingsShow(settings: Readonly<DisplacementSculptSettings>): void {
    this.edgeRadio.setSharedValues([settings.edge]);
    this.radiusSlider.setNumber(settings.radius);
    this.spatialCheckbox.setSharedValues([settings.spatial]);
    this.toolSettingsShow(settings);
  }

  /**
   * Opens or closes the window.
   *
   * @param isShown True to open the window.
   */
  visibilityWrite(isShown: boolean): void {
    if (isShown) {
      this.show();
    } else {
      this.hide();
    }
  }

  /**
   * Returns the viewport mouse bindings of the window's paint tool.
   *
   * @returns Status bar hint text.
   */
  abstract bindingHintRead(): string;

  /**
   * Shows the tool's own controls from the settings.
   *
   * @param settings Current displacement sculpt settings.
   */
  protected abstract toolSettingsShow(settings: Readonly<DisplacementSculptSettings>): void;

  /**
   * Fills the body, starts showing settings changes and shows the current
   * settings. Subclasses call it last in their constructor.
   *
   * @param content Body elements.
   */
  protected contentMount(content: readonly HTMLElement[]): void {
    this.body.append(...content);
    this.disposerAdd(getStateDisplacementSculpt().changeListenerAdd(() => this.settingsShowCurrent()));
    this.settingsShowCurrent();
  }

  /**
   * Stores a positive slider value in the settings, or shows the stored value
   * when the slider holds none.
   *
   * @param slider Slider editing the entry.
   * @param key Settings entry.
   */
  protected positiveSettingCommit(slider: InputSlider, key: DialogDisplacementPaintPositiveKey): void {
    const value = slider.getValue();
    if (value === null || value <= 0) {
      this.settingsShowCurrent();
      return;
    }
    getStateDisplacementSculpt().settingsWrite(key === 'radius' ? { radius: value } : { distance: value });
  }

  /**
   * Returns the viewport tool to Select when the window closes while its tool
   * is active.
   */
  protected override onAfterHide(): void {
    const state = getStateDisplacementSculpt();
    if (state.settingsRead().activeTool === this.paintTool) {
      state.settingsWrite({ activeTool: 'select' });
    }
  }

  /** Shows the current shared settings. */
  private settingsShowCurrent(): void {
    this.settingsShow(getStateDisplacementSculpt().settingsRead());
  }

  /** Writes changes of the shared controls into the settings. */
  private sharedCommitHandlersBind(): void {
    const state = getStateDisplacementSculpt();
    this.edgeRadio.bindCommit(() => {
      const edge = this.edgeRadio.getValue();
      if (edge) state.settingsWrite({ edge });
    });
    this.radiusSlider.bindCommit(() => this.positiveSettingCommit(this.radiusSlider, 'radius'));
    this.spatialCheckbox.bindCommit(() => state.settingsWrite({ spatial: this.spatialCheckbox.getValue() }));
    this.disposerAdd(() => this.edgeRadio.dispose());
    this.disposerAdd(() => this.radiusSlider.dispose());
  }
}
