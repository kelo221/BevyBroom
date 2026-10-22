import type { GameProcessAction } from '@/project/process/game_process_types.js';
import { GAME_PROCESS_DESKTOP_ONLY_MESSAGE } from '@/project/control/game_process_control.js';
import type { ProjectWorkbench } from '@/project/workbench/project_workbench.js';
import { projectWorkbenchActionIsAvailable } from '@/project/workbench/project_workbench_action_availability.js';
import { projectWorkbenchStatusLinesBuild } from '@/project/workbench/project_workbench_status_lines.js';
import {
  panelGamePreviewButtonCreate,
  panelGamePreviewLineCreate,
  panelGamePreviewRowCreate,
} from '@/preview/ui/panel_game_preview_controls.js';

/** Labels and hover texts of the game action buttons. */
const PANEL_GAME_PREVIEW_PROJECT_ACTIONS: ReadonlyArray<{ action: GameProcessAction; label: string; title: string }> = [
  { action: 'launch', label: 'Launch', title: 'Build the game if needed and start it' },
  { action: 'rebuild', label: 'Rebuild', title: 'Stop the game, build it again and start it' },
  { action: 'restart', label: 'Restart', title: 'Stop the game and start it again without building' },
  { action: 'stop', label: 'Stop', title: 'Stop the game this editor started' },
];

/**
 * Game preview panel section that opens a game project and launches, rebuilds,
 * restarts and stops its game. Without process control it explains that the
 * game must be started by hand.
 */
export class PanelGamePreviewProjectSection {
  readonly root: HTMLElement;
  private readonly workbench: ProjectWorkbench;
  private readonly actionButtons = new Map<GameProcessAction, HTMLButtonElement>();
  private readonly relinkButton: HTMLButtonElement;
  private readonly statusList: HTMLElement;

  /**
   * Creates the section.
   *
   * @param workbench Project workbench shown and driven by the section.
   */
  constructor(workbench: ProjectWorkbench) {
    this.workbench = workbench;
    this.root = document.createElement('div');
    this.relinkButton = panelGamePreviewButtonCreate(
      'Link Document',
      'Make the open document belong to this project',
      () => this.workbench.documentRelink(),
    );
    this.statusList = document.createElement('div');
    this.rootPopulate();
    this.refresh();
  }

  /** Rewrites the buttons and lines from the workbench. */
  refresh(): void {
    const status = this.workbench.statusRead();
    this.actionButtons.forEach((button, action) => {
      button.disabled = !projectWorkbenchActionIsAvailable(status, action);
    });
    this.relinkButton.style.display = this.workbench.isDocumentLinkedElsewhere() ? '' : 'none';
    const lines = this.workbench.isAvailable()
      ? projectWorkbenchStatusLinesBuild(status, this.workbench.isDocumentLinkedElsewhere())
      : [{ text: GAME_PROCESS_DESKTOP_ONLY_MESSAGE, isError: false }];
    this.statusList.replaceChildren(...lines.map((line) => panelGamePreviewLineCreate(line.text, line.isError)));
  }

  /** Builds the button rows and the status list. */
  private rootPopulate(): void {
    if (this.workbench.isAvailable()) {
      this.root.appendChild(this.projectRowCreate());
      this.root.appendChild(this.actionRowCreate());
    }
    this.statusList.style.padding = '6px 10px 0';
    this.statusList.style.display = 'flex';
    this.statusList.style.flexDirection = 'column';
    this.statusList.style.gap = '3px';
    this.root.appendChild(this.statusList);
  }

  /**
   * Builds the row with the open project and relink buttons.
   *
   * @returns Row element.
   */
  private projectRowCreate(): HTMLElement {
    const row = panelGamePreviewRowCreate();
    const openButton = panelGamePreviewButtonCreate('Open Project…', 'Open a broom.project.json file', () => {
      void this.workbench.projectOpen(null).finally(() => this.refresh());
    });
    row.append(openButton, this.relinkButton);
    return row;
  }

  /**
   * Builds the row of game action buttons.
   *
   * @returns Row element.
   */
  private actionRowCreate(): HTMLElement {
    const row = panelGamePreviewRowCreate();
    PANEL_GAME_PREVIEW_PROJECT_ACTIONS.forEach(({ action, label, title }) => {
      const button = panelGamePreviewButtonCreate(label, title, () => {
        void this.workbench.actionRun(action).finally(() => this.refresh());
      });
      this.actionButtons.set(action, button);
      row.appendChild(button);
    });
    return row;
  }
}
