import { Theme } from '@/theme.js';
import { PanelFloating } from '@/ui/floating_panel/panel_floating.js';
import { applyFloatingPanelToolChrome } from '@/ui/floating_panel/panel_floating_tool_chrome.js';
import { styleFloatingPanelChromeButton } from '@/ui/floating_panel/panel_floating_title_bar.js';
import type { PreviewLinkService } from '@/preview/link/preview_link_service.js';
import { previewStatusLinesBuild } from '@/preview/ui/preview_status_lines.js';

/**
 * Floating panel that connects the editor to a running game preview, shows what
 * the game received and applied, and requests preview bakes.
 */
export class PanelGamePreview extends PanelFloating {
  private readonly service: PreviewLinkService;
  private readonly endpointInput: HTMLInputElement;
  private readonly connectButton: HTMLButtonElement;
  private readonly bakeButton: HTMLButtonElement;
  private readonly statusList: HTMLElement;
  private readonly removeServiceListener: () => void;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Creates the panel.
   *
   * @param host Parent element of the panel.
   * @param service Preview link service shown and controlled by the panel.
   */
  constructor(host: HTMLElement, service: PreviewLinkService) {
    super(host, { corner: 'bottom-right', insetBelowViewportToolbar: false });
    this.service = service;
    this.endpointInput = document.createElement('input');
    this.connectButton = document.createElement('button');
    this.bakeButton = document.createElement('button');
    this.statusList = document.createElement('div');
    this.rootPopulate();
    this.removeServiceListener = service.changeListenerAdd(() => this.refresh());
    this.refresh();
  }

  /** Rewrites the controls and status lines from the service. */
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
    this.statusList.replaceChildren(...lines.map((line) => this.statusLineCreate(line)));
    this.connectButton.textContent = connectionState === 'disconnected' ? 'Connect' : 'Disconnect';
    this.bakeButton.disabled = connectionState !== 'connected';
  }

  /** Removes listeners, timers and the panel element. */
  override dispose(): void {
    this.removeServiceListener();
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

  /** Stops the status refresh timer. */
  private refreshTimerStop(): void {
    if (this.refreshTimer !== null) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /** Fills the panel with its title bar, endpoint row, actions and status. */
  private rootPopulate(): void {
    applyFloatingPanelToolChrome(this.root, {
      width: '340px',
      borderRadiusPx: 8,
      boxShadow: '0 10px 28px rgba(0,0,0,0.55)',
    });
    this.root.appendChild(this.createStandardTitleBar({ titleText: 'Game Preview' }).bar);
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
    const row = this.rowCreate();
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
    const row = this.rowCreate();
    this.buttonPrepare(this.connectButton, 'Connect to or disconnect from the running game', () =>
      this.connectionToggle(),
    );
    this.buttonPrepare(this.bakeButton, 'Bake preview lighting in the game', () => this.previewBakeRequest());
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

  /**
   * Styles a button and binds its click handler.
   *
   * @param button Button element.
   * @param title Hover text.
   * @param onClick Click handler.
   */
  private buttonPrepare(button: HTMLButtonElement, title: string, onClick: () => void): void {
    button.type = 'button';
    button.title = title;
    styleFloatingPanelChromeButton(button);
    button.style.padding = '3px 10px';
    button.style.fontSize = '12px';
    button.addEventListener('click', onClick);
  }

  /**
   * Creates a padded horizontal row.
   *
   * @returns Row element.
   */
  private rowCreate(): HTMLElement {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '6px';
    row.style.padding = '8px 10px 0';
    return row;
  }

  /**
   * Creates one status line.
   *
   * @param text Line text.
   * @returns Line element.
   */
  private statusLineCreate(text: string): HTMLElement {
    const line = document.createElement('div');
    line.textContent = text;
    line.style.fontSize = '11px';
    line.style.color =
      text.startsWith('Last error') || text.startsWith('Game error') ? '#ff7a6a' : Theme.inputTextColor;
    return line;
  }
}
