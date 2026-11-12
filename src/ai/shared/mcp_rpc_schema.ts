import type {
  LevelBuildPublishRequest,
  LevelBuildPublishResult,
} from '@/level_build/publish/level_build_publish_types.js';
import type { StandaloneHostUpdateCheck } from '@/updater/update_types.js';
import type { TextureProjectListResult, TextureProjectReadResult } from '@/texture/project/texture_project_types.js';
import type { GameProcessAction, GameProcessStatus, ProjectOpenResult } from '@/project/process/game_process_types.js';
import type {
  SprinkleDefinitionFilesReadResult,
  SprinkleDefinitionOpenResult,
} from '@/tools/sprinkle/definition/sprinkle_definition.js';
import type { NativeMenuActionRunParams, NativeMenuBarWire } from '@/native_menu/native_menu_types.js';
import type {
  FileDialogDesktopTextFile,
  FileDialogDesktopTextFileOpenParams,
} from '@/io/dialog/desktop/file_dialog_desktop_types.js';
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
      levelPackagePublish: { params: LevelBuildPublishRequest; response: LevelBuildPublishResult };
      projectTextureList: { params: undefined; response: TextureProjectListResult };
      projectTextureRead: { params: { path: string }; response: TextureProjectReadResult };
      projectSprinkleDefinitionFilesRead: { params: undefined; response: SprinkleDefinitionFilesReadResult };
      projectSprinkleDefinitionOpen: { params: { path: string }; response: SprinkleDefinitionOpenResult };
      nativeMenuBarSet: { params: NativeMenuBarWire; response: void };
      textFileOpen: { params: FileDialogDesktopTextFileOpenParams; response: FileDialogDesktopTextFile | null };
    };
    messages: {};
  };
  webview: {
    requests: {
      invokeEditorTool: { params: McpInvokeEditorToolParams; response: McpToolResult };
      nativeMenuActionRun: { params: NativeMenuActionRunParams; response: boolean };
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
    levelPackagePublish: (params: LevelBuildPublishRequest) => Promise<LevelBuildPublishResult>;
    projectTextureList: () => Promise<TextureProjectListResult>;
    projectTextureRead: (params: { path: string }) => Promise<TextureProjectReadResult>;
    projectSprinkleDefinitionFilesRead: () => Promise<SprinkleDefinitionFilesReadResult>;
    projectSprinkleDefinitionOpen: (params: { path: string }) => Promise<SprinkleDefinitionOpenResult>;
    nativeMenuBarSet: (bar: NativeMenuBarWire) => Promise<void>;
    textFileOpen: (params: FileDialogDesktopTextFileOpenParams) => Promise<FileDialogDesktopTextFile | null>;
  };
}

/** Request surface for invokeEditorTool with MCP tool parameters and results. */
export interface ElectrobunDesktopWebviewCaller {
  request: {
    invokeEditorTool: (params: McpInvokeEditorToolParams) => Promise<McpToolResult>;
    nativeMenuActionRun: (params: NativeMenuActionRunParams) => Promise<boolean>;
  };
}
