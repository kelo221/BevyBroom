import type { StandaloneHostUpdateCheck } from '@/updater/update_types.js';
import type { GameProcessAction, GameProcessStatus, ProjectOpenResult } from '@/project/process/game_process_types.js';
import type {
  McpHostStartResult,
  McpHostStatus,
  McpInvokeEditorToolParams,
  McpToolResult,
} from './mcp_protocol_types.js';

/** Electrobun RPC schema for bun and webview request and message surfaces. */
export interface ElectrobunDesktopRpcSchema {
  bun: {
    requests: {
      checkForUpdate: { params: undefined; response: StandaloneHostUpdateCheck };
      installUpdate: { params: undefined; response: void };
      startMcpServer: { params: undefined; response: McpHostStartResult };
      stopMcpServer: { params: undefined; response: McpHostStatus };
      getMcpStatus: { params: undefined; response: McpHostStatus };
      projectChooseFile: { params: undefined; response: string | null };
      projectOpen: { params: { projectFile: string }; response: ProjectOpenResult };
      gameProcessAction: { params: { action: GameProcessAction }; response: GameProcessStatus };
      gameProcessStatus: { params: undefined; response: GameProcessStatus };
    };
    messages: {};
  };
  webview: {
    requests: {
      invokeEditorTool: { params: McpInvokeEditorToolParams; response: McpToolResult };
    };
    messages: {};
  };
}

/** Bun-side request surface for update and MCP host control methods. */
export interface ElectrobunDesktopBunRpcClient {
  request: {
    checkForUpdate: () => Promise<StandaloneHostUpdateCheck>;
    installUpdate: () => Promise<void>;
    startMcpServer: () => Promise<McpHostStartResult>;
    stopMcpServer: () => Promise<McpHostStatus>;
    getMcpStatus: () => Promise<McpHostStatus>;
    projectChooseFile: () => Promise<string | null>;
    projectOpen: (params: { projectFile: string }) => Promise<ProjectOpenResult>;
    gameProcessAction: (params: { action: GameProcessAction }) => Promise<GameProcessStatus>;
    gameProcessStatus: () => Promise<GameProcessStatus>;
  };
}

/** Request surface for invokeEditorTool with MCP tool parameters and results. */
export interface ElectrobunDesktopWebviewCaller {
  request: {
    invokeEditorTool: (params: McpInvokeEditorToolParams) => Promise<McpToolResult>;
  };
}
