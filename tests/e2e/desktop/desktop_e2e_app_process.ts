import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DESKTOP_MCP_AUTOSTART_ENVIRONMENT_KEY,
  DESKTOP_MCP_AUTOSTART_URL_PREFIX,
} from '@/desktop/desktop_mcp_autostart.js';
import { DESKTOP_WINDOW_HIDDEN_ENVIRONMENT_KEY } from '@/desktop/desktop_window_startup.js';

/** Interval between two looks at the app output while waiting for the MCP URL. */
const DESKTOP_E2E_OUTPUT_CHECK_MILLISECONDS = 100;

/**
 * Environment variable WebView2 reads its user data folder from, ahead of the
 * app's choice.
 */
const WEBVIEW2_USER_DATA_FOLDER_ENVIRONMENT_KEY = 'WEBVIEW2_USER_DATA_FOLDER';

/** Name prefix of the per-app WebView2 data folders in the temp directory. */
const WEBVIEW_DATA_DIRECTORY_PREFIX = 'broom_e2e_webview_';

/** Age after which a data folder left by an earlier run is removed. */
const WEBVIEW_DATA_STALE_MILLISECONDS = 60 * 60 * 1000;

/**
 * Removes a folder, retrying while the webview processes of a stopped app still
 * release their files.
 *
 * @param directory Folder to remove.
 */
function webviewDataDirectoryRemove(directory: string): void {
  try {
    rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  } catch {
    // Still locked; a later run removes it once it is stale.
  }
}

/** Removes data folders that earlier runs could not remove. */
function webviewDataStaleRemove(): void {
  const now = Date.now();
  for (const name of readdirSync(tmpdir())) {
    const directory = join(tmpdir(), name);
    try {
      if (
        name.startsWith(WEBVIEW_DATA_DIRECTORY_PREFIX) &&
        now - statSync(directory).mtimeMs > WEBVIEW_DATA_STALE_MILLISECONDS
      ) {
        webviewDataDirectoryRemove(directory);
      }
    } catch {
      // Removed meanwhile by another run.
    }
  }
}

/**
 * Starts and stops the built desktop app with its MCP server started at launch.
 * Each instance has its own WebView2 data folder: apps sharing one share a
 * browser process and local storage, so stopping one app could take another
 * suite's editor down with it.
 */
export class DesktopE2eAppProcess {
  private readonly executable: string;
  private readonly mcpBasePort: number;
  private readonly isWindowShown: boolean;
  private child: ChildProcess | null = null;
  private output = '';
  private readonly webviewDataDirectory: string;

  /**
   * Creates a stopped app process.
   *
   * @param executable Path of the built app launcher.
   * @param mcpBasePort First port the app's MCP server tries.
   * @param isWindowShown Shows the app window; otherwise the app runs with its
   *   window hidden.
   */
  constructor(executable: string, mcpBasePort: number, isWindowShown: boolean) {
    this.executable = executable;
    this.mcpBasePort = mcpBasePort;
    this.isWindowShown = isWindowShown;
    webviewDataStaleRemove();
    this.webviewDataDirectory = mkdtempSync(join(tmpdir(), WEBVIEW_DATA_DIRECTORY_PREFIX));
    process.once('exit', () => webviewDataDirectoryRemove(this.webviewDataDirectory));
  }

  /**
   * Returns everything every started app wrote to its output so far.
   *
   * @returns Output text.
   */
  outputRead(): string {
    return this.output;
  }

  /**
   * Starts the app, asking it to start its MCP server at launch and to keep its
   * window hidden unless shown.
   */
  start(): void {
    const environment = {
      ...process.env,
      [DESKTOP_MCP_AUTOSTART_ENVIRONMENT_KEY]: String(this.mcpBasePort),
      [DESKTOP_WINDOW_HIDDEN_ENVIRONMENT_KEY]: this.isWindowShown ? '0' : '1',
      [WEBVIEW2_USER_DATA_FOLDER_ENVIRONMENT_KEY]: this.webviewDataDirectory,
    };
    const child = spawn(this.executable, [], { env: environment, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout?.on('data', (chunk: Buffer) => this.outputAppend(chunk));
    child.stderr?.on('data', (chunk: Buffer) => this.outputAppend(chunk));
    this.child = child;
  }

  /**
   * Waits until the app announces the URL of its MCP server.
   *
   * @param timeoutMilliseconds Longest wait.
   * @returns The MCP endpoint URL.
   */
  async mcpUrlWait(timeoutMilliseconds: number): Promise<string> {
    const outputStart = this.output.length;
    const end = performance.now() + timeoutMilliseconds;
    while (performance.now() < end) {
      const url = this.mcpUrlFind(this.output.slice(outputStart));
      if (url !== null) {
        return url;
      }
      await new Promise((resolve) => setTimeout(resolve, DESKTOP_E2E_OUTPUT_CHECK_MILLISECONDS));
    }
    throw new Error(`The desktop app announced no MCP URL; output:\n${this.output}`);
  }

  /** Stops the app with every process it started and waits until it exited. */
  async stop(): Promise<void> {
    const child = this.child;
    this.child = null;
    if (!child || child.exitCode !== null || child.pid === undefined) {
      return;
    }
    const exited = once(child, 'exit');
    this.processTreeKill(child);
    await exited;
  }

  /**
   * Returns the MCP URL announced in a piece of output.
   *
   * @param text Output text.
   * @returns The URL, or null when none was announced.
   */
  private mcpUrlFind(text: string): string | null {
    const line = text.split(/\r?\n/).find((candidate) => candidate.startsWith(DESKTOP_MCP_AUTOSTART_URL_PREFIX));
    return line === undefined ? null : line.slice(DESKTOP_MCP_AUTOSTART_URL_PREFIX.length).trim();
  }

  /**
   * Appends app output to the collected text.
   *
   * @param chunk Output bytes.
   */
  private outputAppend(chunk: Buffer): void {
    this.output += chunk.toString('utf8');
  }

  /**
   * Ends a process and its children; the launcher starts the main process and
   * the webview as children.
   *
   * @param child Launcher process.
   */
  private processTreeKill(child: ChildProcess): void {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      return;
    }
    child.kill();
  }
}
