import type { DisplacementSculptSettings } from '@/displacement/state/state_displacement_sculpt.js';
import type {
  ControllerDisplacementActions,
  DisplacementActionResult,
} from '@/displacement/controller/controller_displacement_actions.js';
import { faceEditSheetGroupBoxCreate } from '@/texture/ui/face_edit_sheet/widgets/face_edit_sheet_widget_group_box.js';

/**
 * Runs one displacement action on the selected faces.
 *
 * @param action Action to run with the installed actions.
 */
export type PanelDisplacementActionRun = (
  action: (actions: ControllerDisplacementActions) => DisplacementActionResult,
) => void;

/** Height in pixels of the Displacement tab buttons. */
export const PANEL_DISPLACEMENT_BUTTON_HEIGHT_PX = 22;

/**
 * One titled group box of Displacement tab controls. Shows the shared
 * displacement sculpt settings and the selected faces; owns cleanup functions
 * its subclasses register.
 */
export abstract class PanelDisplacementSection {
  protected readonly element: HTMLElement;
  private readonly disposers: Array<() => void> = [];

  /**
   * Creates the section group box.
   *
   * @param title Group box title.
   * @param className Class name of the group box.
   */
  constructor(title: string, className: string) {
    this.element = faceEditSheetGroupBoxCreate(title, className);
    this.element.style.display = 'flex';
    this.element.style.flexDirection = 'column';
    this.element.style.gap = '4px';
  }

  /**
   * Returns the section element.
   *
   * @returns Section root.
   */
  getElement(): HTMLElement {
    return this.element;
  }

  /**
   * Shows the given settings in the section's fields. Sections without setting
   * fields keep this empty implementation.
   *
   * @param _settings Current displacement sculpt settings.
   */
  settingsShow(_settings: Readonly<DisplacementSculptSettings>): void {}

  /**
   * Shows the state of the selected faces in the section's fields. Sections
   * that do not depend on the selection keep this empty implementation.
   *
   * @param _actions Installed actions over the selected faces, or null when
   *   none are installed.
   */
  selectionShow(_actions: ControllerDisplacementActions | null): void {}

  /** Runs every registered cleanup function. */
  dispose(): void {
    this.disposers.splice(0).forEach((disposer) => disposer());
  }

  /**
   * Registers a cleanup function run once by dispose.
   *
   * @param disposer Cleanup function, for example a listener removal.
   */
  protected disposerAdd(disposer: () => void): void {
    this.disposers.push(disposer);
  }
}
