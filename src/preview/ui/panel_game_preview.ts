import { Theme } from '@/theme.js';
import type { PreviewLinkService } from '@/preview/link/preview_link_service.js';
import { previewStatusLinesBuild } from '@/preview/ui/preview_status_lines.js';
import type { ProjectWorkbench } from '@/project/workbench/project_workbench.js';
import { PanelGamePreviewProjectSection } from '@/preview/ui/panel_game_preview_project_section.js';
import {
  panelGamePreviewButtonPrepare,
  panelGamePreviewLineCreate,
  panelGamePreviewRowCreate,
} from '@/preview/ui/panel_game_preview_controls.js';

/**
 * Game Preview page of the bottom strip: opens a game project and runs its
 * game, connects the editor to a running game preview, shows what the game
 * received and applied, and requests preview bakes.
 */
export class PanelGamePreview {
  private readonly root: HTMLElement;
  private readonly service: PreviewLinkService;
  private readonly projectSection: PanelGamePreviewProjectSection;
  private readonly endpointInput: HTMLInputElement;
  private readonly connectButton: HTMLButtonElement;
  private readonly bakeButton: HTMLButtonElement;
  private readonly statusList: HTMLElement;
  private readonly removeListeners: Array<() => void>;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Creates the page and appends it to its host.
   *
   * @param host Element the page is shown in.
   * @param service Preview link service shown and controlled by the panel.
   * @param workbench Project workbench shown and driven by the panel.
   */
  constructor(host: HTMLElement, service: PreviewLinkService, workbench: ProjectWorkbench) {
    this.root = host.ownerDocument.createElement('div');
    this.service = service;
    this.projectSection = new PanelGamePreviewProjectSection(workbench);
    this.endpointInput = document.createElement('input');
    this.connectButton = document.createElement('button');
    this.bakeButton = document.createElement('button');
    this.statusList = document.createElement('div');
    this.rootPopulate();
    host.appendChild(this.root);
    this.removeListeners = [
      service.changeListenerAdd(() => this.refresh()),
      workbench.changeListenerAdd(() => this.refresh()),
    ];
    this.refresh();
  }

  /** Rewrites the controls and status lines from the service and workbench. */
  refresh(): void {
    const controller = this.service.controllerRead();
    const connectionState = controller?.connectionStateRead() ?? 'disconnected';
    const revisions = controller?.revisionsRead() ?? { state: 0, geometry: 0 };
    const lines = previewStatusLinesBuild({
      connectionState,
      status: controller?.gameStatusRead() ?? null,
      sentStateRevision: revisions.state,
      sentGeometryRevision: revisions.geometry,
      lastError: controller?.lastErrorRead() ?? '',
    });
    this.statusList.replaceChildren(
      ...lines.map((line) =>
        panelGamePreviewLineCreate(line, line.startsWith('Last error') || line.startsWith('Game error')),
      ),
    );
    this.connectButton.textContent = connectionState === 'disconnected' ? 'Connect' : 'Disconnect';
    this.bakeButton.disabled = connectionState !== 'connected';
    this.endpointInputSync();
    this.projectSection.refresh();
  }

  /**
   * Returns the page element.
   *
   * @returns Root element of the page.
   */
  getElement(): HTMLElement {
    return this.root;
  }

  /**
   * Starts refreshing the game status lines while the page is shown and stops
   * while it is hidden.
   *
   * @param isShown Whether the page is shown now.
   */
  shownSet(isShown: boolean): void {
    this.refreshTimerStop();
    if (isShown) {
      this.refreshTimer = setInterval(() => this.refresh(), 500);
      this.refresh();
    }
  }

  /**
   * Tells whether the status lines refresh on a timer.
   *
   * @returns True while the page counts as shown.
   */
  isShown(): boolean {
    return this.refreshTimer !== null;
  }

  /** Removes listeners, timers and the page element. */
  dispose(): void {
    this.removeListeners.forEach((removeListener) => removeListener());
    this.refreshTimerStop();
    this.root.remove();
  }

  /** Shows the remembered endpoint unless the user is editing the field. */
  private endpointInputSync(): void {
    if (document.activeElement !== this.endpointInput) {
      this.endpointInput.value = this.service.endpointRead();
    }
  }

  /** Stops the status refresh timer. */
  private refreshTimerStop(): void {
    if (this.refreshTimer !== null) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Fills the page with the controls column (project section, endpoint row and
   * actions) beside the status lines, so it fits the short, wide bottom strip.
   */
  private rootPopulate(): void {
    this.root.classList.add('panel-game-preview');
    this.root.style.display = 'flex';
    this.root.style.flexWrap = 'wrap';
    this.root.style.alignItems = 'flex-start';
    this.root.style.height = '100%';
    this.root.style.overflow = 'auto';
    this.root.append(this.controlsColumnCreate(), this.statusList);
    this.statusList.style.padding = '6px 10px 10px';
    this.statusList.style.display = 'flex';
    this.statusList.style.flexDirection = 'column';
    this.statusList.style.gap = '3px';
    this.statusList.style.flex = '1 1 240px';
  }

  /**
   * Builds the column holding the project section, endpoint row and actions.
   *
   * @returns Column element.
   */
  private controlsColumnCreate(): HTMLElement {
    const column = this.root.ownerDocument.createElement('div');
    column.style.flex = '0 0 340px';
    column.style.maxWidth = '100%';
    column.append(this.projectSection.root, this.endpointRowCreate(), this.actionRowCreate());
    return column;
  }

  /**
   * Builds the endpoint input row.
   *
   * @returns Row element.
   */
  private endpointRowCreate(): HTMLElement {
    const row = panelGamePreviewRowCreate();
    this.endpointInput.type = 'text';
    this.endpointInput.value = this.service.endpointRead();
    this.endpointInput.setAttribute('aria-label', 'Game preview endpoint');
    this.endpointInput.style.flex = '1';
    this.endpointInput.style.minWidth = '0';
    this.endpointInput.style.background = Theme.inputBackgroundColor;
    this.endpointInput.style.color = Theme.inputTextColor;
    this.endpointInput.style.border = `1px solid ${Theme.inputBorderColor}`;
    this.endpointInput.style.padding = '3px 6px';
    this.endpointInput.addEventListener('change', () => this.service.endpointWrite(this.endpointInput.value));
    row.appendChild(this.endpointInput);
    return row;
  }

  /**
   * Builds the connect and bake button row.
   *
   * @returns Row element.
   */
  private actionRowCreate(): HTMLElement {
    const row = panelGamePreviewRowCreate();
    panelGamePreviewButtonPrepare(this.connectButton, 'Connect to or disconnect from the running game', () =>
      this.connectionToggle(),
    );
    panelGamePreviewButtonPrepare(this.bakeButton, 'Bake preview lighting in the game', () =>
      this.previewBakeRequest(),
    );
    this.bakeButton.textContent = 'Preview Bake';
    row.append(this.connectButton, this.bakeButton);
    return row;
  }

  /** Connects when disconnected, otherwise disconnects. */
  private connectionToggle(): void {
    const connectionState = this.service.controllerRead()?.connectionStateRead() ?? 'disconnected';
    if (connectionState === 'disconnected') {
      this.service.endpointWrite(this.endpointInput.value);
      this.service.connect();
      return;
    }
    this.service.disconnect();
  }

  /** Asks the game for a preview bake. */
  private previewBakeRequest(): void {
    void this.service
      .controllerRead()
      ?.previewBakeRequest()
      .catch(() => this.refresh());
  }
}
