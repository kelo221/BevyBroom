import { vi, type Mock } from 'vitest';
import type { BridgeMcpDesktop } from '@/ai/client/bridge_mcp_desktop.js';
import type { McpHostStatus } from '@/ai/shared/mcp_protocol_types.js';
import type { SettingsMcpTabServices } from '@/ui/settings/settings_mcp_tab.js';

/** MCP page services whose calls a test inspects. */
export interface SettingsMcpTestServices extends SettingsMcpTabServices {
  readonly statusShow: Mock<(message: string) => void>;
  readonly runningChanged: Mock<(isRunning: boolean) => void>;
  readonly aiCapturesOpen: Mock<() => void>;
}

/**
 * Builds MCP page services around a bridge, recording every call.
 *
 * @param bridge Desktop MCP bridge, or null for the browser build.
 * @returns Services for the MCP page.
 */
export function settingsMcpTestServicesCreate(bridge: BridgeMcpDesktop | null): SettingsMcpTestServices {
  return {
    bridgeRead: () => bridge,
    statusShow: vi.fn<(message: string) => void>(),
    runningChanged: vi.fn<(isRunning: boolean) => void>(),
    aiCapturesOpen: vi.fn<() => void>(),
  };
}

/**
 * Builds a desktop MCP bridge that starts and stops a server on one URL.
 *
 * @param url URL the started server reports.
 * @param isRunningAtStart Whether the server already runs.
 * @returns Bridge.
 */
export function settingsMcpTestBridgeCreate(url: string, isRunningAtStart: boolean): BridgeMcpDesktop {
  let isRunning = isRunningAtStart;
  const statusRead = (): McpHostStatus =>
    isRunning ? { running: true, port: Number(new URL(url).port), url } : { running: false, port: null, url: null };
  return {
    startMcpServer: async () => {
      isRunning = true;
      return { ok: true, message: 'MCP server started', status: statusRead() };
    },
    stopMcpServer: async () => {
      isRunning = false;
      return statusRead();
    },
    getMcpStatus: async () => statusRead(),
  };
}
