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
 * Longest wait for one launch to announce its MCP URL before the app is started
 * again. A healthy launch announces it within a few seconds; a launch whose
 * WebView2 environment never comes up never does.
 */
const DESKTOP_E2E_LAUNCH_ATTEMPT_MILLISECONDS = 25000;

/**
 * Launcher output line announcing the main process it spawned, capturing its
 * id.
 */
const DESKTOP_E2E_SPAWN_EVENT_PATTERN = /\[electrobun:process\] \{"event":"spawn".*?"pid":(\d+)/g;

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
  private launchOutputStart = 0;
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
    this.launchOutputStart = this.output.length;
    const child = spawn(this.executable, [], { env: environment, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout?.on('data', (chunk: Buffer) => this.outputAppend(chunk));
    child.stderr?.on('data', (chunk: Buffer) => this.outputAppend(chunk));
    this.child = child;
  }

  /**
   * Waits until the started app announces the URL of its MCP server. A launch
   * that announces nothing within one attempt window is stopped and started
   * again, as long as the overall wait allows.
   *
   * @param timeoutMilliseconds Longest overall wait.
   * @returns The MCP endpoint URL.
   */
  async mcpUrlWait(timeoutMilliseconds: number): Promise<string> {
    const end = performance.now() + timeoutMilliseconds;
    let outputStart = this.output.length;
    while (performance.now() < end) {
      const attemptEnd = Math.min(end, performance.now() + DESKTOP_E2E_LAUNCH_ATTEMPT_MILLISECONDS);
      const url = await this.mcpUrlWaitUntil(outputStart, attemptEnd);
      if (url !== null) {
        return url;
      }
      if (performance.now() >= end) {
        break;
      }
      outputStart = await this.launchRestart();
    }
    throw new Error(`The desktop app announced no MCP URL; output:\n${this.output}`);
  }

  /**
   * Looks at the output written since a given offset until it announces the MCP
   * URL or a deadline passes.
   *
   * @param outputStart Offset in the collected output where the launch began.
   * @param deadline Value of performance.now() after which the look stops.
   * @returns The URL, or null when none was announced before the deadline.
   */
  private async mcpUrlWaitUntil(outputStart: number, deadline: number): Promise<string | null> {
    while (performance.now() < deadline) {
      const url = this.mcpUrlFind(this.output.slice(outputStart));
      if (url !== null) {
        return url;
      }
      await new Promise((resolve) => setTimeout(resolve, DESKTOP_E2E_OUTPUT_CHECK_MILLISECONDS));
    }
    return null;
  }

  /**
   * Stops a launch that announced nothing and starts the app again, noting the
   * restart in the collected output.
   *
   * @returns Offset in the collected output where the new launch begins.
   */
  private async launchRestart(): Promise<number> {
    await this.stop();
    this.output += '\n[e2e] the launch announced no MCP URL; starting the app again\n';
    const outputStart = this.output.length;
    this.start();
    return outputStart;
  }

  /**
   * Stops the app with every process it started and waits until the launcher
   * exited. The main process the launcher announced is ended too, since it
   * outlives a launcher that already exited and is then out of reach of the
   * launcher's process tree.
   */
  async stop(): Promise<void> {
    const child = this.child;
    this.child = null;
    if (!child) {
      return;
    }
    const mainProcessIds = this.mainProcessIdsRead();
    if (child.exitCode === null && child.pid !== undefined) {
      const exited = once(child, 'exit');
      this.processTreeKill(child.pid);
      await exited;
    }
    mainProcessIds.forEach((processId) => this.processTreeKill(processId));
  }

  /**
   * Returns the ids of the main processes the current launch's launcher
   * announced spawning.
   *
   * @returns Process ids, in announcement order.
   */
  private mainProcessIdsRead(): number[] {
    const launchOutput = this.output.slice(this.launchOutputStart);
    return Array.from(launchOutput.matchAll(DESKTOP_E2E_SPAWN_EVENT_PATTERN), (match) => Number(match[1]));
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
   * Ends a process and its children, doing nothing when it is already gone.
   *
   * @param processId Id of the process.
   */
  private processTreeKill(processId: number): void {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(processId), '/T', '/F'], { stdio: 'ignore' });
      return;
    }
    try {
      process.kill(processId);
    } catch {
      return;
    }
  }
}
