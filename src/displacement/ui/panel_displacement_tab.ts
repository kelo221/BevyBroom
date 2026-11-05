import { Theme } from '@/theme.js';
import { getStateDisplacementSculpt } from '@/displacement/state/state_displacement_sculpt.js';
import type {
  ControllerDisplacementActions,
  DisplacementActionResult,
} from '@/displacement/controller/controller_displacement_actions.js';
import type { PanelDisplacementSection } from './panel_displacement_section.js';
import { PanelDisplacementActionsSection } from './panel_displacement_actions_section.js';
import { PanelDisplacementPaintSection } from './panel_displacement_paint_section.js';

/** Services the Displacement tab runs its actions through. */
export interface PanelDisplacementTabDeps {
  /** Returns the actions bound to the face selection, or null when unavailable. */
  readonly actionsRead: () => ControllerDisplacementActions | null;
  /** Reports an action outcome, for example on the status bar. */
  readonly statusReport: (message: string) => void;
  /** Refreshes the viewport after an action changed faces. */
  readonly afterChange: () => void;
}

/**
 * Hammer++ style Displacement tab: Create, Destroy, Subdivide, Invert Alpha,
 * Sew, Smooth, Noise, Elevation, Scale and the Paint Geometry settings.
 */
export class PanelDisplacementTab {
  private readonly element: HTMLElement;
  private readonly statusLine: HTMLElement;
  private readonly sections: readonly PanelDisplacementSection[];
  private readonly unsubscribeSettings: () => void;

  /**
   * Builds the tab and shows the shared settings.
   *
   * @param deps Action services.
   */
  constructor(private readonly deps: PanelDisplacementTabDeps) {
    this.element = document.createElement('div');
    this.element.className = 'panel-displacement-tab';
    this.element.style.display = 'flex';
    this.element.style.flexDirection = 'column';
    this.element.style.gap = '6px';
    this.statusLine = this.statusLineCreate();
    this.sections = [
      new PanelDisplacementActionsSection((action) => this.actionRun(action)),
      new PanelDisplacementPaintSection(),
    ];
    this.element.append(...this.sections.map((section) => section.getElement()), this.statusLine);
    this.unsubscribeSettings = getStateDisplacementSculpt().changeListenerAdd(() => this.settingsShow());
    this.settingsShow();
  }

  /**
   * Returns the tab element.
   *
   * @returns Tab root.
   */
  getElement(): HTMLElement {
    return this.element;
  }

  /**
   * Returns the last action outcome shown under the controls.
   *
   * @returns Status text.
   */
  statusTextRead(): string {
    return this.statusLine.textContent ?? '';
  }

  /** Removes listeners and the tab element. */
  dispose(): void {
    this.unsubscribeSettings();
    this.sections.forEach((section) => section.dispose());
    this.element.remove();
  }

  /**
   * Runs one action on the selected faces and reports its outcome.
   *
   * @param action Action to run with the installed actions.
   */
  private actionRun(action: (actions: ControllerDisplacementActions) => DisplacementActionResult): void {
    const actions = this.deps.actionsRead();
    if (!actions) {
      this.statusShow('Displacement tools are not available');
      return;
    }
    const result = action(actions);
    this.statusShow(result.message);
    if (result.ok) {
      this.deps.afterChange();
    }
  }

  /**
   * Shows an outcome under the controls and reports it.
   *
   * @param message Outcome text.
   */
  private statusShow(message: string): void {
    this.statusLine.textContent = message;
    this.deps.statusReport(message);
  }

  /** Shows the shared settings in every section. */
  private settingsShow(): void {
    const settings = getStateDisplacementSculpt().settingsRead();
    this.sections.forEach((section) => section.settingsShow(settings));
  }

  /**
   * Creates the outcome line shown under the controls.
   *
   * @returns Status element.
   */
  private statusLineCreate(): HTMLElement {
    const line = document.createElement('div');
    line.className = 'panel-displacement-tab-status';
    line.style.fontSize = '11px';
    line.style.color = Theme.statusBarTextColor;
    line.style.minHeight = '14px';
    return line;
  }
}
