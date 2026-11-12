import { APPLICATION_DISPLAY_NAME, buildDesktopWindowTitle } from '@/application_identity.js';
import type { ElectrobunDesktopRpcSchema, ElectrobunDesktopWebviewCaller } from '@/ai/shared/mcp_rpc_schema.js';
import { McpHost } from '@/ai/server/mcp_host.js';
import type { StandaloneHostUpdateCheck } from '@/updater/update_types.js';
import { buildDesktopWindowFrame } from '@/desktop/desktop_window_maximize.js';
import { desktopWindowHiddenRequested, showMaximizedWhenReady } from '@/desktop/desktop_window_startup.js';
import { desktopWindowReopenHandle } from '@/desktop/desktop_window_reopen.js';
import { enableWindowsPerMonitorDpiAwareness } from '@/desktop/windows_dpi_awareness.js';
import { applyWindowsWindowIcon } from '@/desktop/windows_window_icon.js';
import { desktopMcpAutostartRun } from '@/desktop/desktop_mcp_autostart.js';
import { desktopProfileMigrationRun } from '@/desktop/desktop_profile_migration_legacy.js';
import { GameProcessHost } from '@/desktop/bun/game_process/game_process_host.js';
import { GameProcessSpawnerNode } from '@/desktop/bun/game_process/game_process_spawner_node.js';
import { gameProcessProjectReaderNodeCreate } from '@/desktop/bun/game_process/game_process_project_reader.js';
import { gameProcessRpcHandlersCreate } from '@/desktop/bun/game_process/game_process_rpc_handlers.js';
import { projectTextureRpcHandlersCreate } from '@/desktop/bun/project_textures/project_texture_rpc_handlers.js';
import { projectSprinkleRpcHandlersCreate } from '@/desktop/bun/project_sprinkle/project_sprinkle_rpc_handlers.js';
import { projectLevelRpcHandlersCreate } from '@/desktop/bun/project_levels/project_level_rpc_handlers.js';
import { NativeMenuHost } from '@/desktop/bun/native_menu/native_menu_host.js';
import {
  textFileRpcHandlersCreate,
  textFileRpcServicesDiskCreate,
} from '@/desktop/bun/text_file/text_file_rpc_handlers.js';
import { textFileSavePanelMacShow } from '@/desktop/bun/text_file/text_file_save_panel_mac.js';
import type { NativeMenuBarWire } from '@/native_menu/native_menu_types.js';

await enableWindowsPerMonitorDpiAwareness();

const { app, ApplicationMenu, BrowserView, BrowserWindow, Screen, Updater, Utils } = await import('electrobun/main');
const isMacDesktop = process.platform === 'darwin';
const isDesktopWindowKeptHidden = desktopWindowHiddenRequested(process.env);

console.log(`desktop profile migration: ${desktopProfileMigrationRun(Utils.paths.userData, process.platform)}`);

const mcpHost = new McpHost();
const gameProcessHost = new GameProcessHost(new GameProcessSpawnerNode(), gameProcessProjectReaderNodeCreate());
process.on('exit', () => gameProcessHost.disposeNow());
app.on('before-quit', desktopQuitPrepare);
let desktopRpc: ElectrobunDesktopWebviewCaller | null = null;
const nativeMenuHost = isMacDesktop
  ? new NativeMenuHost(ApplicationMenu, APPLICATION_DISPLAY_NAME, nativeMenuActionForward)
  : null;

const desktopRpcBinding = BrowserView.defineRPC<ElectrobunDesktopRpcSchema>({
  maxRequestTime: 120000,
  handlers: {
    requests: {
      checkForUpdate: checkForUpdate,
      installUpdate: installUpdate,
      startMcpServer: startMcpServer,
      stopMcpServer: stopMcpServer,
      getMcpStatus: getMcpStatus,
      ...gameProcessRpcHandlersCreate(gameProcessHost, () =>
        Utils.openFileDialog({ allowedFileTypes: 'json', canChooseDirectory: false, allowsMultipleSelection: false }),
      ),
      ...projectTextureRpcHandlersCreate(gameProcessHost),
      ...projectSprinkleRpcHandlersCreate(gameProcessHost),
      ...projectLevelRpcHandlersCreate(gameProcessHost),
      nativeMenuBarSet: nativeMenuBarSet,
      ...textFileRpcHandlersCreate(
        textFileRpcServicesDiskCreate({
          openDialogShow: (allowedFileTypes) =>
            Utils.openFileDialog({ allowedFileTypes, canChooseDirectory: false, allowsMultipleSelection: false }),
          savePanelShow: textFileSavePanelMacShow,
        }),
      ),
    },
  },
});
desktopRpc = desktopRpcBinding as unknown as ElectrobunDesktopWebviewCaller;

const localInfo = await Updater.getLocalInfo();
const windowTitle = buildDesktopWindowTitle(localInfo.version);
const desktopFrame = buildDesktopWindowFrame(Screen.getPrimaryDisplay().workArea);

const desktopWindow = new BrowserWindow({
  title: windowTitle,
  url: 'views://main_ui/index.html',
  frame: desktopFrame,
  hidden: true,
  activate: false,
  titleBarStyle: isMacDesktop ? 'hiddenInset' : 'default',
  rpc: desktopRpcBinding,
});
showMaximizedWhenReady(desktopWindow, desktopWindowShownHandle, isDesktopWindowKeptHidden);
if (isMacDesktop) {
  app.on('reopen', () => desktopWindowReopenHandle(desktopWindow, isDesktopWindowKeptHidden));
}

/**
 * Stops the game process and the MCP server before the app quits, so Command+Q
 * leaves no child process behind.
 */
function desktopQuitPrepare(): void {
  gameProcessHost.disposeNow();
  mcpHost.stop();
}

/**
 * Starts the MCP server when asked for at launch and applies the window icon,
 * once the page is ready.
 */
async function desktopWindowShownHandle(): Promise<void> {
  desktopMcpAutostartRun(process.env, (basePort) => mcpHost.start(invokeEditorTool, basePort), console.log);
  await applyWindowsWindowIcon(windowTitle);
}

/**
 * Installs the page menu bar as the macOS menu bar; other platforms keep the
 * menus inside the page.
 *
 * @param bar Page menu bar snapshot.
 */
function nativeMenuBarSet(bar: NativeMenuBarWire): void {
  nativeMenuHost?.menuBarSet(bar);
}

/**
 * Runs a chosen macOS menu row inside the page.
 *
 * @param actionId Id of the chosen row.
 */
function nativeMenuActionForward(actionId: string): void {
  void desktopRpc?.request.nativeMenuActionRun({ actionId });
}

/** Checks Electrobun's configured release channel. */
async function checkForUpdate(): Promise<StandaloneHostUpdateCheck> {
  const current = await Updater.getLocalInfo();
  const latest = await Updater.checkForUpdate();
  const result: StandaloneHostUpdateCheck = {
    currentVersion: current.version,
    latestVersion: latest.version,
    updateAvailable: latest.updateAvailable,
  };
  if (latest.error) result.error = latest.error;
  return result;
}

/** Downloads and applies the update prepared by Electrobun. */
async function installUpdate(): Promise<void> {
  await Updater.downloadUpdate();
  await Updater.applyUpdate();
}

/**
 * Starts the local MCP host and forwards tools into the webview editor.
 *
 * @returns Start result with URL and token.
 */
function startMcpServer() {
  return mcpHost.start(invokeEditorTool);
}

/**
 * Runs one MCP tool in the webview editor.
 *
 * @param name Tool name.
 * @param args Tool arguments.
 * @returns Tool result from the editor.
 */
async function invokeEditorTool(name: string, args: Record<string, unknown>) {
  if (!desktopRpc) {
    return { ok: false, message: 'Desktop RPC is not ready' };
  }
  return desktopRpc.request.invokeEditorTool({ name, arguments: args });
}

/**
 * Stops the local MCP host.
 *
 * @returns Host status snapshot.
 */
function stopMcpServer() {
  return mcpHost.stop();
}

/**
 * Returns whether the MCP host is running.
 *
 * @returns Host status snapshot.
 */
function getMcpStatus() {
  return mcpHost.getStatus();
}
