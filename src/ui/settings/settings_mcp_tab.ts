import type { BridgeMcpDesktop } from '@/ai/client/bridge_mcp_desktop.js';
import type { McpHostStatus } from '@/ai/shared/mcp_protocol_types.js';
import {
  createSettingsButton,
  createSettingsCategory,
  createSettingsControlRow,
  createSettingsSecondaryButton,
  styleSettingsTextInput,
} from './settings_form_controls.js';

/** Text shown in the URL field while the server gives no URL. */
const SETTINGS_MCP_NO_URL = '—';

/** What the MCP page needs from the editor. */
export interface SettingsMcpTabServices {
  /** Returns the desktop MCP host bridge, or null outside the desktop app. */
  readonly bridgeRead: () => BridgeMcpDesktop | null;
  /** Shows a short message in the status bar. */
  readonly statusShow: (message: string) => void;
  /** Told whether the server runs after each status read. */
  readonly runningChanged: (isRunning: boolean) => void;
  /** Opens the AI Captures debug window. */
  readonly aiCapturesOpen: () => void;
}

/**
 * MCP page of Settings: starts and stops the desktop MCP server, shows and
 * copies its URL, and holds the AI Captures debug window for developers.
 */
export class SettingsMcpTab {
  private readonly root: HTMLElement;
  private readonly services: SettingsMcpTabServices;
  private readonly statusLine: HTMLElement;
  private readonly urlField: HTMLInputElement;
  private readonly serverButton: HTMLButtonElement;
  private isRunning: boolean;

  /**
   * Builds the page; the server status is read when the page is activated.
   *
   * @param services Editor services the page uses.
   */
  constructor(services: SettingsMcpTabServices) {
    this.services = services;
    this.isRunning = false;
    this.root = document.createElement('div');
    this.root.style.display = 'flex';
    this.root.style.flexDirection = 'column';
    this.statusLine = document.createElement('div');
    this.urlField = this.urlFieldCreate();
    this.serverButton = createSettingsButton('Start server', () => void this.serverToggle());
    this.serverButton.dataset['settingsAction'] = 'mcp-server-toggle';
    this.root.append(this.serverSectionCreate(), this.developerSectionCreate());
  }

  /**
   * Returns the page element.
   *
   * @returns Root element.
   */
  getElement(): HTMLElement {
    return this.root;
  }

  /**
   * Tells whether the last status read found the server running.
   *
   * @returns True while running.
   */
  isServerRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Reads the server status again and shows it.
   *
   * @returns Promise settled once the status is shown.
   */
  async activate(): Promise<void> {
    const bridge = this.services.bridgeRead();
    if (bridge === null) {
      this.desktopOnlyStateApply('Status: unavailable in the browser build');
      return;
    }
    try {
      this.statusApply(await bridge.getMcpStatus());
    } catch {
      this.desktopOnlyStateApply('Status: desktop RPC unavailable');
    }
  }

  /**
   * Builds the server section: status, steps, URL and the server buttons.
   *
   * @returns Section element.
   */
  private serverSectionCreate(): HTMLElement {
    const { section, body } = createSettingsCategory('MCP server');
    this.statusLine.textContent = 'Status: checking…';
    this.statusLine.dataset['mcpField'] = 'status';
    body.append(this.statusLine, this.instructionsCreate());
    body.appendChild(createSettingsControlRow('URL', this.urlField));
    body.appendChild(this.serverButtonRowCreate());
    return section;
  }

  /**
   * Builds the developer section with the AI Captures button.
   *
   * @returns Section element.
   */
  private developerSectionCreate(): HTMLElement {
    const { section, body } = createSettingsCategory('Developer');
    const button = createSettingsSecondaryButton('AI Captures…', () => this.services.aiCapturesOpen());
    button.dataset['settingsAction'] = 'ai-captures-open';
    button.title = 'Images the AI tools captured with capture_view';
    body.appendChild(createSettingsControlRow('Debug window', button));
    return section;
  }

  /**
   * Builds the numbered steps for connecting an AI tool.
   *
   * @returns Paragraph element.
   */
  private instructionsCreate(): HTMLElement {
    const instructions = document.createElement('p');
    instructions.style.margin = '0';
    instructions.style.whiteSpace = 'pre-wrap';
    instructions.textContent = [
      'Lets AI tools edit this map while the desktop app is open.',
      '1. Start the server.',
      '2. Copy the URL.',
      '3. Add that URL as an HTTP MCP server in your AI tool (no password or token).',
    ].join('\n');
    return instructions;
  }

  /**
   * Builds the read-only URL field that selects its text on focus.
   *
   * @returns Input element.
   */
  private urlFieldCreate(): HTMLInputElement {
    const field = document.createElement('input');
    field.type = 'text';
    field.readOnly = true;
    field.value = SETTINGS_MCP_NO_URL;
    field.dataset['mcpField'] = 'mcp-url';
    field.setAttribute('aria-label', 'MCP URL');
    styleSettingsTextInput(field);
    field.addEventListener('focus', () => field.select());
    return field;
  }

  /**
   * Builds the row with Copy URL and Start / Stop server.
   *
   * @returns Row element.
   */
  private serverButtonRowCreate(): HTMLElement {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.justifyContent = 'flex-end';
    row.style.gap = '8px';
    row.append(
      createSettingsSecondaryButton('Copy URL', () => void this.urlCopy()),
      this.serverButton,
    );
    return row;
  }

  /**
   * Stops the server when it runs, otherwise starts it.
   *
   * @returns Promise settled once the new status is shown.
   */
  private async serverToggle(): Promise<void> {
    const bridge = this.services.bridgeRead();
    if (bridge === null) {
      this.services.statusShow('MCP is only available in the desktop app');
      return;
    }
    if (this.isRunning) {
      this.statusApply(await bridge.stopMcpServer());
      this.services.statusShow('MCP server stopped');
      return;
    }
    const result = await bridge.startMcpServer();
    this.statusApply(result.status);
    this.services.statusShow(result.message);
  }

  /**
   * Shows a server status: running with its port and URL, or stopped.
   *
   * @param status Status reported by the desktop host.
   */
  private statusApply(status: McpHostStatus): void {
    this.runningSet(status.running);
    this.serverButton.disabled = false;
    this.serverButton.textContent = status.running ? 'Stop server' : 'Start server';
    const url = status.running ? (status.url?.trim() ?? '') : '';
    this.statusLine.textContent =
      url === '' ? 'Status: stopped' : `Status: running on port ${status.port ?? SETTINGS_MCP_NO_URL}`;
    this.urlField.value = url === '' ? SETTINGS_MCP_NO_URL : url;
  }

  /**
   * Shows that the server cannot run here.
   *
   * @param statusText Status line text.
   */
  private desktopOnlyStateApply(statusText: string): void {
    this.runningSet(false);
    this.serverButton.textContent = 'Desktop only';
    this.serverButton.disabled = true;
    this.statusLine.textContent = statusText;
    this.urlField.value = SETTINGS_MCP_NO_URL;
  }

  /**
   * Remembers whether the server runs and tells the editor.
   *
   * @param isRunning Whether the server runs.
   */
  private runningSet(isRunning: boolean): void {
    this.isRunning = isRunning;
    this.services.runningChanged(isRunning);
  }

  /**
   * Copies the server URL to the clipboard.
   *
   * @returns Promise settled once copied or refused.
   */
  private async urlCopy(): Promise<void> {
    const url = this.urlField.value.trim();
    if (url === '' || url === SETTINGS_MCP_NO_URL) {
      this.services.statusShow('Start the MCP server before copying the URL');
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      this.services.statusShow('MCP URL copied');
    } catch {
      this.services.statusShow('Could not copy MCP URL');
    }
  }
}
