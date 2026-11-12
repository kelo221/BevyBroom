import { Electroview } from 'electrobun/view';
import { buildDesktopWindowTitle } from '@/application_identity.js';
import { sharedMcpBridgeHandler } from '@/ai/client/handler_mcp_bridge.js';
import { createMcpDesktopBridge } from '@/ai/client/bridge_mcp_desktop.js';
import { GameProcessControlDesktop } from '@/project/control/game_process_control_desktop.js';
import type { ElectrobunDesktopBunRpcClient, ElectrobunDesktopRpcSchema } from '@/ai/shared/mcp_rpc_schema.js';
import type { McpInvokeEditorToolParams } from '@/ai/shared/mcp_protocol_types.js';
import type { NativeMenuActionRunParams } from '@/native_menu/native_menu_types.js';
import { storageMigrationLegacyPrefixRunInBrowser } from '@/settings/storage/storage_migration_legacy_prefix.js';
import { createElectrobunUpdaterBridge, type ElectrobunUpdaterRpcClient } from '@/updater/electrobun_updater_rpc.js';
import { NativeMenuBridgeDesktop } from '@/native_menu/native_menu_bridge_desktop.js';
import { desktopWindowChromeMacInstall } from '@/desktop/main_ui/desktop_window_chrome_mac.js';
import { platformIsMac } from '@/platform/platform_kind.js';

document.title = buildDesktopWindowTitle();
let nativeMenuBridge: NativeMenuBridgeDesktop | null = null;

const desktopRpc = Electroview.defineRPC<ElectrobunDesktopRpcSchema>({
  maxRequestTime: 600000,
  handlers: {
    requests: {
      invokeEditorTool: (params: McpInvokeEditorToolParams) => sharedMcpBridgeHandler.invokeEditorTool(params),
      nativeMenuActionRun: (params: NativeMenuActionRunParams) => nativeMenuBridge?.actionRun(params) ?? false,
    },
  },
}) as unknown as ElectrobunDesktopBunRpcClient & ElectrobunUpdaterRpcClient;

new Electroview({ rpc: desktopRpc as never });
window.bevybroomStandaloneUpdater = createElectrobunUpdaterBridge(desktopRpc);
window.bevybroomMcpBridge = createMcpDesktopBridge(desktopRpc);
window.bevybroomGameProcessControl = new GameProcessControlDesktop(desktopRpc);
if (platformIsMac()) {
  nativeMenuBridge = new NativeMenuBridgeDesktop(desktopRpc);
  window.bevybroomNativeMenuBridge = nativeMenuBridge;
  desktopWindowChromeMacInstall(document);
}
storageMigrationLegacyPrefixRunInBrowser();
await import('@/app.js');
