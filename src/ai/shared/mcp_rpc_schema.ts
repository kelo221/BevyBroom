import type { ProjectFileReadResult } from '@/project/files/project_file_read_result.js';
import type {
  LevelBuildPublishRequest,
  LevelBuildPublishResult,
} from '@/level_build/publish/level_build_publish_types.js';
import type { StandaloneHostUpdateCheck } from '@/updater/update_types.js';
import type { TextureProjectListResult, TextureProjectReadResult } from '@/texture/project/texture_project_types.js';
import type {
  GameProcessAction,
  GameProcessLevelTarget,
  GameProcessStatus,
  ProjectOpenResult,
} from '@/project/process/game_process_types.js';
import type {
  GameProcessCommandStartResult,
  RunConfiguration,
  RunConfigurationCommandSection,
  RunConfigurationsWriteResult,
} from '@/project/run_configuration/model/run_configuration_types.js';
import type {
  ProjectLevelCreateRequest,
  ProjectLevelListResult,
  ProjectLevelReadResult,
  ProjectLevelRenameRequest,
  ProjectLevelWriteRequest,
  ProjectLevelWriteResult,
} from '@/project/level/project_level_types.js';
import type {
  SprinkleDefinitionFilesReadResult,
  SprinkleDefinitionOpenResult,
} from '@/tools/sprinkle/definition/sprinkle_definition.js';
import type {
  ProjectDataFileChangeResult,
  ProjectDataFileKind,
  ProjectDataFileRemoveRequest,
  ProjectDataFileRevealRequest,
  ProjectDataFilesReadResult,
  ProjectDataFileWriteRequest,
} from '@/project/data/project_data_file_types.js';
import type { NativeMenuActionRunParams, NativeMenuBarWire } from '@/native_menu/native_menu_types.js';
import type {
  FileDialogDesktopFileStat,
  FileDialogDesktopFileStatParams,
  FileDialogDesktopSavePickParams,
  FileDialogDesktopTextFile,
  FileDialogDesktopTextFileOpenParams,
  FileDialogDesktopTextFileWriteParams,
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
      gameProcessAction: {
        params: { action: GameProcessAction; level?: GameProcessLevelTarget | null };
        response: GameProcessStatus;
      };
      gameProcessStatus: { params: undefined; response: GameProcessStatus };
      gameProcessCommandStart: {
        params: { command: RunConfigurationCommandSection; level?: GameProcessLevelTarget | null };
        response: GameProcessCommandStartResult;
      };
      runConfigurationsWrite: {
        params: { configurations: RunConfiguration[] };
        response: RunConfigurationsWriteResult;
      };
      levelPackagePublish: { params: LevelBuildPublishRequest; response: LevelBuildPublishResult };
      projectTextureList: { params: undefined; response: TextureProjectListResult };
      projectTextureRead: { params: { path: string }; response: TextureProjectReadResult };
      projectModelRead: { params: { path: string }; response: ProjectFileReadResult };
      projectSprinkleDefinitionFilesRead: { params: undefined; response: SprinkleDefinitionFilesReadResult };
      projectSprinkleDefinitionOpen: { params: { path: string }; response: SprinkleDefinitionOpenResult };
      projectLevelList: { params: undefined; response: ProjectLevelListResult };
      projectLevelRead: { params: { document: string }; response: ProjectLevelReadResult };
      projectLevelWrite: { params: ProjectLevelWriteRequest; response: ProjectLevelWriteResult };
      projectLevelCreate: { params: ProjectLevelCreateRequest; response: ProjectLevelWriteResult };
      projectLevelRename: { params: ProjectLevelRenameRequest; response: ProjectLevelWriteResult };
      projectDataFilesRead: { params: { kind: ProjectDataFileKind }; response: ProjectDataFilesReadResult };
      projectDataFileWrite: { params: ProjectDataFileWriteRequest; response: ProjectDataFileChangeResult };
      projectDataFileRemove: { params: ProjectDataFileRemoveRequest; response: ProjectDataFileChangeResult };
      projectDataFileReveal: { params: ProjectDataFileRevealRequest; response: ProjectDataFileChangeResult };
      nativeMenuBarSet: { params: NativeMenuBarWire; response: void };
      textFileOpen: { params: FileDialogDesktopTextFileOpenParams; response: FileDialogDesktopTextFile | null };
      savePathPick: { params: FileDialogDesktopSavePickParams; response: string | null };
      textFileWrite: { params: FileDialogDesktopTextFileWriteParams; response: FileDialogDesktopFileStat };
      fileStat: { params: FileDialogDesktopFileStatParams; response: FileDialogDesktopFileStat | null };
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
    gameProcessAction: (params: {
      action: GameProcessAction;
      level?: GameProcessLevelTarget | null;
    }) => Promise<GameProcessStatus>;
    gameProcessStatus: () => Promise<GameProcessStatus>;
    gameProcessCommandStart: (params: {
      command: RunConfigurationCommandSection;
      level?: GameProcessLevelTarget | null;
    }) => Promise<GameProcessCommandStartResult>;
    runConfigurationsWrite: (params: { configurations: RunConfiguration[] }) => Promise<RunConfigurationsWriteResult>;
    levelPackagePublish: (params: LevelBuildPublishRequest) => Promise<LevelBuildPublishResult>;
    projectTextureList: () => Promise<TextureProjectListResult>;
    projectTextureRead: (params: { path: string }) => Promise<TextureProjectReadResult>;
    projectModelRead: (params: { path: string }) => Promise<ProjectFileReadResult>;
    projectSprinkleDefinitionFilesRead: () => Promise<SprinkleDefinitionFilesReadResult>;
    projectSprinkleDefinitionOpen: (params: { path: string }) => Promise<SprinkleDefinitionOpenResult>;
    projectLevelList: () => Promise<ProjectLevelListResult>;
    projectLevelRead: (params: { document: string }) => Promise<ProjectLevelReadResult>;
    projectLevelWrite: (params: ProjectLevelWriteRequest) => Promise<ProjectLevelWriteResult>;
    projectLevelCreate: (params: ProjectLevelCreateRequest) => Promise<ProjectLevelWriteResult>;
    projectLevelRename: (params: ProjectLevelRenameRequest) => Promise<ProjectLevelWriteResult>;
    projectDataFilesRead: (params: { kind: ProjectDataFileKind }) => Promise<ProjectDataFilesReadResult>;
    projectDataFileWrite: (params: ProjectDataFileWriteRequest) => Promise<ProjectDataFileChangeResult>;
    projectDataFileRemove: (params: ProjectDataFileRemoveRequest) => Promise<ProjectDataFileChangeResult>;
    projectDataFileReveal: (params: ProjectDataFileRevealRequest) => Promise<ProjectDataFileChangeResult>;
    nativeMenuBarSet: (bar: NativeMenuBarWire) => Promise<void>;
    textFileOpen: (params: FileDialogDesktopTextFileOpenParams) => Promise<FileDialogDesktopTextFile | null>;
    savePathPick: (params: FileDialogDesktopSavePickParams) => Promise<string | null>;
    textFileWrite: (params: FileDialogDesktopTextFileWriteParams) => Promise<FileDialogDesktopFileStat>;
    fileStat: (params: FileDialogDesktopFileStatParams) => Promise<FileDialogDesktopFileStat | null>;
  };
}

/** Request surface for invokeEditorTool with MCP tool parameters and results. */
export interface ElectrobunDesktopWebviewCaller {
  request: {
    invokeEditorTool: (params: McpInvokeEditorToolParams) => Promise<McpToolResult>;
    nativeMenuActionRun: (params: NativeMenuActionRunParams) => Promise<boolean>;
  };
}
