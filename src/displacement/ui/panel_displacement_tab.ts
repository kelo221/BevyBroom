import { Theme } from '@/theme.js';
import { getStateDisplacementSculpt } from '@/displacement/state/state_displacement_sculpt.js';
import type {
  ControllerDisplacementActions,
  DisplacementActionResult,
} from '@/displacement/controller/controller_displacement_actions.js';
import type { PanelDisplacementSection } from './panel_displacement_section.js';
import { PanelDisplacementToolsSection } from './panel_displacement_tools_section.js';
import { PanelDisplacementAttributesSection } from './panel_displacement_attributes_section.js';
import { PanelDisplacementMasksSection } from './panel_displacement_masks_section.js';
import { DialogDisplacementNoise } from './noise/dialog_displacement_noise.js';

/** Services the Displacement tab runs its actions through. */
export interface PanelDisplacementTabDeps {
  /** Returns the actions bound to the face selection, or null when unavailable. */
  readonly actionsRead: () => ControllerDisplacementActions | null;
  /**
   * Subscribes to changes of the installed actions, the selected faces or their
   * displacements.
   */
  readonly changeListenerAdd: (listener: () => void) => () => void;
  /** Parent element hosting the tab's floating windows. */
  readonly floatingHost: HTMLElement;
  /** Reports an action outcome, for example on the status bar. */
  readonly statusReport: (message: string) => void;
  /** Refreshes the viewport after an action changed faces. */
  readonly afterChange: () => void;
}

/**
 * Hammer++ style Displacement tab: the Tools, Attributes and Masks groups, the
 * Noise window and the outcome of the last action.
 */
export class PanelDisplacementTab {
  /** Noise window opened by the Noise tool. */
  readonly noiseDialog: DialogDisplacementNoise;
  private readonly element: HTMLElement;
  private readonly statusLine: HTMLElement;
  private readonly sections: readonly PanelDisplacementSection[];
  private readonly unsubscribers: ReadonlyArray<() => void>;

  /**
   * Builds the tab and shows the shared settings and the selected faces.
   *
   * @param deps Action services.
   */
  constructor(private readonly deps: PanelDisplacementTabDeps) {
    this.element = this.rootCreate();
    this.statusLine = this.statusLineCreate();
    const actionRun = (action: (actions: ControllerDisplacementActions) => DisplacementActionResult): void =>
      this.actionRun(action);
    this.noiseDialog = new DialogDisplacementNoise(deps.floatingHost, actionRun);
    this.sections = [
      new PanelDisplacementToolsSection(actionRun, () => this.noiseDialog.show()),
      new PanelDisplacementAttributesSection(actionRun),
      new PanelDisplacementMasksSection(actionRun),
    ];
    this.element.append(...this.sections.map((section) => section.getElement()), this.statusLine);
    this.unsubscribers = [
      getStateDisplacementSculpt().changeListenerAdd(() => this.settingsShow()),
      deps.changeListenerAdd(() => this.selectionShow()),
    ];
    this.selectionShow();
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

  /** Removes listeners, the Noise window and the tab element. */
  dispose(): void {
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.sections.forEach((section) => section.dispose());
    this.noiseDialog.dispose();
    this.element.remove();
  }

  /**
   * Runs one action on the selected faces, reports its outcome and shows the
   * selection afterwards.
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
    this.selectionShow();
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

  /** Shows the selected faces in every section. */
  private selectionShow(): void {
    const actions = this.deps.actionsRead();
    this.sections.forEach((section) => section.selectionShow(actions));
  }

  /**
   * Creates the tab root column.
   *
   * @returns Root element.
   */
  private rootCreate(): HTMLElement {
    const element = document.createElement('div');
    element.className = 'panel-displacement-tab';
    element.style.display = 'flex';
    element.style.flexDirection = 'column';
    element.style.gap = '6px';
    return element;
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
