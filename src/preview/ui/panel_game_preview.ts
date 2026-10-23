import { Theme } from '@/theme.js';
import { PanelFloating } from '@/ui/floating_panel/panel_floating.js';
import { applyFloatingPanelToolChrome } from '@/ui/floating_panel/panel_floating_tool_chrome.js';
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
 * Floating panel that opens a game project and runs its game, connects the
 * editor to a running game preview, shows what the game received and applied,
 * and requests preview bakes.
 */
export class PanelGamePreview extends PanelFloating {
  private readonly service: PreviewLinkService;
  private readonly projectSection: PanelGamePreviewProjectSection;
  private readonly endpointInput: HTMLInputElement;
  private readonly connectButton: HTMLButtonElement;
  private readonly bakeButton: HTMLButtonElement;
  private readonly statusList: HTMLElement;
  private readonly removeListeners: Array<() => void>;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Creates the panel.
   *
   * @param host Parent element of the panel.
   * @param service Preview link service shown and controlled by the panel.
   * @param workbench Project workbench shown and driven by the panel.
   */
  constructor(host: HTMLElement, service: PreviewLinkService, workbench: ProjectWorkbench) {
    super(host, { corner: 'bottom-right', insetBelowViewportToolbar: false });
    this.service = service;
    this.projectSection = new PanelGamePreviewProjectSection(workbench);
    this.endpointInput = document.createElement('input');
    this.connectButton = document.createElement('button');
    this.bakeButton = document.createElement('button');
    this.statusList = document.createElement('div');
    this.rootPopulate();
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

  /** Removes listeners, timers and the panel element. */
  override dispose(): void {
    this.removeListeners.forEach((removeListener) => removeListener());
    this.refreshTimerStop();
    super.dispose();
  }

  /** Starts refreshing the game status lines while the panel is open. */
  protected override onAfterShow(): void {
    this.refreshTimerStop();
    this.refreshTimer = setInterval(() => this.refresh(), 500);
    this.refresh();
  }

  /** Stops refreshing while the panel is closed. */
  protected override onAfterHide(): void {
    this.refreshTimerStop();
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
   * Fills the panel with its title bar, project section, endpoint row, actions
   * and status.
   */
  private rootPopulate(): void {
    applyFloatingPanelToolChrome(this.root, {
      width: '340px',
      borderRadiusPx: 8,
      boxShadow: '0 10px 28px rgba(0,0,0,0.55)',
    });
    this.root.appendChild(this.createStandardTitleBar({ titleText: 'Game Preview' }).bar);
    this.root.appendChild(this.projectSection.root);
    this.root.appendChild(this.endpointRowCreate());
    this.root.appendChild(this.actionRowCreate());
    this.statusList.style.padding = '6px 10px 10px';
    this.statusList.style.display = 'flex';
    this.statusList.style.flexDirection = 'column';
    this.statusList.style.gap = '3px';
    this.root.appendChild(this.statusList);
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
