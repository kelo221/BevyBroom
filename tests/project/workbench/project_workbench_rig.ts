import * as THREE from 'three';
import { ConsoleLog } from '@/info_panel/console/console_log.js';
import { GameProcessControl } from '@/project/control/game_process_control.js';
import type {
  GameProcessAction,
  GameProcessLevelTarget,
  GameProcessStatus,
  ProjectOpenResult,
  ProjectSummary,
} from '@/project/process/game_process_types.js';
import type {
  LevelBuildPublishRequest,
  LevelBuildPublishResult,
} from '@/level_build/publish/level_build_publish_types.js';
import type { TextureProjectListResult, TextureProjectReadResult } from '@/texture/project/texture_project_types.js';
import type { ProjectFileReadResult } from '@/project/files/project_file_read_result.js';
import type {
  SprinkleDefinitionFile,
  SprinkleDefinitionFilesReadResult,
  SprinkleDefinitionOpenResult,
} from '@/tools/sprinkle/definition/sprinkle_definition.js';
import type {
  ProjectLevelCreateRequest,
  ProjectLevelListResult,
  ProjectLevelReadResult,
  ProjectLevelRenameRequest,
  ProjectLevelSummary,
  ProjectLevelWriteRequest,
  ProjectLevelWriteResult,
} from '@/project/level/project_level_types.js';
import type {
  ProjectDataFileChangeResult,
  ProjectDataFileKind,
  ProjectDataFileRemoveRequest,
  ProjectDataFileRevealRequest,
  ProjectDataFilesReadResult,
  ProjectDataFileWriteRequest,
} from '@/project/data/project_data_file_types.js';
import { projectLevelDocumentFromName, projectLevelIdFromDocument } from '@/project/model/project_level_entry.js';
import { ProjectRecentStore } from '@/project/recent/project_recent_store.js';
import { ProjectWorkbench, type ProjectWorkbenchLink } from '@/project/workbench/project_workbench.js';
import { ProjectWorkbenchConsoleReporter } from '@/project/workbench/project_workbench_console_reporter.js';
import { ControllerLevelBuild } from '@/level_build/controller_level_build.js';
import type { ProjectLevelOpen } from '@/project/level/project_level_open.js';

/** Process control that opens any file as a project named after it. */
export class GameProcessControlFake extends GameProcessControl {
  readonly isAvailable = true;
  readonly actions: GameProcessAction[] = [];
  /** Level passed with every action, in order. */
  readonly actionLevels: (GameProcessLevelTarget | null)[] = [];
  chosenFile: string | null = null;
  nextStatus: GameProcessStatus | null = null;
  readonly publishedLevels: LevelBuildPublishRequest[] = [];
  nextPublishResult: LevelBuildPublishResult | null = null;
  /** Base64 image bytes by asset-relative path, per project file. */
  readonly projectTextureFiles = new Map<string, Map<string, string>>();
  /**
   * Settles before every project texture read answers; replace it to hold reads
   * back.
   */
  projectTextureReadGate: Promise<void> = Promise.resolve();
  /** Base64 model bytes by asset-relative path. */
  readonly projectModelFiles = new Map<string, string>();
  /** Every model path asked to be read, in order. */
  readonly projectModelReads: string[] = [];
  /** Sprinkle definition files, per project file. */
  readonly projectSprinkleFiles = new Map<string, SprinkleDefinitionFile[]>();
  /** Paths of every sprinkle definition file asked to open. */
  readonly openedSprinkleDefinitions: string[] = [];
  /** Every project data file asked to be shown in the file manager. */
  readonly revealedDataFiles: ProjectDataFileRevealRequest[] = [];
  /** Answer of every sprinkle definition open request. */
  nextSprinkleOpenResult: SprinkleDefinitionOpenResult = { ok: true };
  /** Level document texts by document path, per project file. */
  readonly projectLevelDocuments = new Map<string, Map<string, string>>();
  /** Modification time given to the next written level document. */
  nextLevelModifiedMilliseconds = 1000;
  /**
   * Project data file texts by kind and file name; a missing kind is not
   * configured.
   */
  readonly projectDataFiles = new Map<ProjectDataFileKind, Map<string, string>>();
  /** Only file name each kind kept in one file may write. */
  readonly projectDataFixedFileNames = new Map<ProjectDataFileKind, string>();

  /** @inheritdoc */
  async projectChooseFile(): Promise<string | null> {
    return this.chosenFile;
  }

  /** @inheritdoc */
  async projectOpen(projectFile: string): Promise<ProjectOpenResult> {
    if (projectFile.includes('missing')) {
      return { ok: false, message: `Cannot open ${projectFile}` };
    }
    this.nextStatus = gameStatusCreate(projectSummaryCreate(projectFile), 'idle');
    return { ok: true, status: this.nextStatus };
  }

  /** @inheritdoc */
  async actionStart(action: GameProcessAction, level: GameProcessLevelTarget | null): Promise<GameProcessStatus> {
    this.actions.push(action);
    this.actionLevels.push(level);
    return this.statusRead();
  }

  /** @inheritdoc */
  async statusRead(): Promise<GameProcessStatus> {
    return this.nextStatus ?? gameStatusCreate(null, 'idle');
  }

  /** @inheritdoc */
  async levelPackagePublish(request: LevelBuildPublishRequest): Promise<LevelBuildPublishResult> {
    this.publishedLevels.push(request);
    return (
      this.nextPublishResult ?? {
        ok: true,
        levelDirectory: `/levels/${request.levelName}`,
        geometryFile: 'geometry.glb',
        geometryRevision: 1,
        removedGeometryFiles: [],
      }
    );
  }

  /** @inheritdoc */
  async projectTextureList(): Promise<TextureProjectListResult> {
    const projectFile = this.nextStatus?.project?.projectFile ?? null;
    if (projectFile === null) {
      return { ok: false, message: 'No project is open.' };
    }
    const texturePaths = Array.from(this.projectTextureFilesRead(projectFile).keys()).sort();
    return { ok: true, projectFile, texturePaths };
  }

  /** @inheritdoc */
  async projectTextureRead(path: string): Promise<TextureProjectReadResult> {
    const projectFile = this.nextStatus?.project?.projectFile ?? '';
    await this.projectTextureReadGate;
    const bytesBase64 = this.projectTextureFilesRead(projectFile).get(path);
    return bytesBase64 === undefined ? { ok: false, message: `No texture ${path}` } : { ok: true, path, bytesBase64 };
  }

  /** @inheritdoc */
  async projectModelRead(path: string): Promise<ProjectFileReadResult> {
    this.projectModelReads.push(path);
    const bytesBase64 = this.projectModelFiles.get(path);
    return bytesBase64 === undefined ? { ok: false, message: `No model ${path}` } : { ok: true, path, bytesBase64 };
  }

  /** @inheritdoc */
  async projectSprinkleDefinitionFilesRead(): Promise<SprinkleDefinitionFilesReadResult> {
    const projectFile = this.nextStatus?.project?.projectFile ?? null;
    if (projectFile === null) {
      return { ok: false, message: 'No project is open.' };
    }
    return { ok: true, files: this.projectSprinkleFiles.get(projectFile) ?? [] };
  }

  /** @inheritdoc */
  async projectSprinkleDefinitionOpen(path: string): Promise<SprinkleDefinitionOpenResult> {
    this.openedSprinkleDefinitions.push(path);
    return this.nextSprinkleOpenResult;
  }

  /** @inheritdoc */
  async projectLevelList(): Promise<ProjectLevelListResult> {
    const projectFile = this.nextStatus?.project?.projectFile ?? null;
    if (projectFile === null) {
      return { ok: false, message: 'No project is open.' };
    }
    const documents = Array.from(this.projectLevelDocumentsRead(projectFile).keys()).sort();
    const levels = documents.map((document) => this.projectLevelSummaryCreate(document));
    return { ok: true, projectFile, documentDirectory: `${projectFile}/../broom/documents`, levels };
  }

  /** @inheritdoc */
  async projectLevelRead(document: string): Promise<ProjectLevelReadResult> {
    const text = this.projectLevelDocumentsRead(this.nextStatus?.project?.projectFile ?? '').get(document);
    if (text === undefined) {
      return { ok: false, message: `No level document ${document}` };
    }
    return { ok: true, level: this.projectLevelSummaryCreate(document), text };
  }

  /** @inheritdoc */
  async projectLevelWrite(request: ProjectLevelWriteRequest): Promise<ProjectLevelWriteResult> {
    this.projectLevelDocumentsRead(this.nextStatus?.project?.projectFile ?? '').set(request.document, request.text);
    this.nextLevelModifiedMilliseconds += 1;
    return { ok: true, level: this.projectLevelSummaryCreate(request.document) };
  }

  /** @inheritdoc */
  async projectLevelCreate(request: ProjectLevelCreateRequest): Promise<ProjectLevelWriteResult> {
    const document = projectLevelDocumentFromName(request.name);
    if (this.projectLevelDocumentsRead(this.nextStatus?.project?.projectFile ?? '').has(document)) {
      return { ok: false, message: `Level ${document} exists`, refusal: 'exists' };
    }
    return this.projectLevelWrite({ document, text: request.text, knownModifiedMilliseconds: null });
  }

  /** @inheritdoc */
  async projectLevelRename(request: ProjectLevelRenameRequest): Promise<ProjectLevelWriteResult> {
    const documents = this.projectLevelDocumentsRead(this.nextStatus?.project?.projectFile ?? '');
    const text = documents.get(request.document);
    const target = projectLevelDocumentFromName(request.name);
    if (text === undefined || documents.has(target)) {
      return { ok: false, message: `Cannot rename ${request.document}`, refusal: 'exists' };
    }
    documents.delete(request.document);
    documents.set(target, text);
    return { ok: true, level: this.projectLevelSummaryCreate(target) };
  }

  /** @inheritdoc */
  async projectDataFilesRead(kind: ProjectDataFileKind): Promise<ProjectDataFilesReadResult> {
    const files = this.projectDataFiles.get(kind);
    if (files === undefined) {
      return { ok: true, isConfigured: false, fixedFileName: null, files: [] };
    }
    const fixedFileName = this.projectDataFixedFileNames.get(kind) ?? null;
    const sorted = [...files.entries()].sort(([first], [second]) => first.localeCompare(second));
    return { ok: true, isConfigured: true, fixedFileName, files: sorted.map(([name, text]) => ({ name, text })) };
  }

  /** @inheritdoc */
  async projectDataFileWrite(request: ProjectDataFileWriteRequest): Promise<ProjectDataFileChangeResult> {
    const files = this.projectDataFiles.get(request.kind);
    if (files === undefined) {
      return { ok: false, message: `The project file names no location for ${request.kind}.` };
    }
    files.set(request.name, request.text);
    return { ok: true };
  }

  /** @inheritdoc */
  async projectDataFileRemove(request: ProjectDataFileRemoveRequest): Promise<ProjectDataFileChangeResult> {
    this.projectDataFiles.get(request.kind)?.delete(request.name);
    return { ok: true };
  }

  /**
   * Records which data file was asked to be shown, refusing files that do not
   * exist.
   *
   * @param request Kind and file name.
   * @returns Success, or a refusal for a missing file.
   */
  async projectDataFileReveal(request: ProjectDataFileRevealRequest): Promise<ProjectDataFileChangeResult> {
    if (this.projectDataFiles.get(request.kind)?.has(request.name) !== true) {
      return { ok: false, message: `${request.name} does not exist` };
    }
    this.revealedDataFiles.push(request);
    return { ok: true };
  }

  /**
   * Returns the fake level documents of one project, creating the store.
   *
   * @param projectFile Project file path.
   * @returns Document texts by document path.
   */
  projectLevelDocumentsRead(projectFile: string): Map<string, string> {
    const existing = this.projectLevelDocuments.get(projectFile);
    if (existing) {
      return existing;
    }
    const created = new Map<string, string>();
    this.projectLevelDocuments.set(projectFile, created);
    return created;
  }

  /**
   * Builds the summary of a fake level document.
   *
   * @param document Document path.
   * @returns Level summary with the current fake modification time.
   */
  private projectLevelSummaryCreate(document: string): ProjectLevelSummary {
    return {
      id: projectLevelIdFromDocument(document),
      name: document.replace(/\.json$/i, ''),
      document,
      modifiedMilliseconds: this.nextLevelModifiedMilliseconds,
      isListed: false,
    };
  }

  /**
   * Returns the fake images of one project.
   *
   * @param projectFile Project file path.
   * @returns Base64 image bytes by asset-relative path.
   */
  private projectTextureFilesRead(projectFile: string): Map<string, string> {
    return this.projectTextureFiles.get(projectFile) ?? new Map();
  }
}

/**
 * Creates the summary of a project named after its file's folder.
 *
 * @param projectFile Project file path.
 * @returns Project summary.
 */
export function projectSummaryCreate(projectFile: string): ProjectSummary {
  const folder = projectFile.split('/').slice(-2, -1)[0] ?? 'project';
  return {
    projectFile,
    projectIdentifier: `id-${folder}`,
    name: folder,
    endpoint: `http://127.0.0.1:1/${folder}`,
    canLaunch: true,
    canBuild: true,
    isLevelLaunch: false,
    isLevelExportLaunch: false,
    toolTextures: { nodraw: [] },
    problems: [],
  };
}

/**
 * Creates a status.
 *
 * @param project Open project.
 * @param phase Phase.
 * @returns Status.
 */
export function gameStatusCreate(project: ProjectSummary | null, phase: GameProcessStatus['phase']): GameProcessStatus {
  return {
    project,
    phase,
    processId: null,
    exitCode: null,
    diagnostics: [],
    gameNotices: [],
    logTail: [],
    message: phase,
    generation: 1,
  };
}

/** Link double recording endpoints and connects. */
export class ProjectWorkbenchLinkFake implements ProjectWorkbenchLink {
  readonly endpoints: string[] = [];
  connectCount = 0;
  isActive = false;

  /** @inheritdoc */
  endpointWrite(endpoint: string): void {
    this.endpoints.push(endpoint);
  }

  /** @inheritdoc */
  connect(): void {
    this.connectCount += 1;
    this.isActive = true;
  }

  /** @inheritdoc */
  isLinkActive(): boolean {
    return this.isActive;
  }
}

/**
 * Creates a workbench with fakes and a private console log.
 *
 * @param worldGroup World root holding the document's project link.
 * @param openLevelRead Returns the project level the scene belongs to; none by
 *   default.
 * @param openLevelSave Saves the open level; levels are not saved without it.
 * @returns Workbench and its collaborators.
 */
export function workbenchRigCreate(
  worldGroup: THREE.Group = new THREE.Group(),
  openLevelRead: () => ProjectLevelOpen | null = () => null,
  openLevelSave?: () => Promise<string | null>,
) {
  const control = new GameProcessControlFake();
  const link = new ProjectWorkbenchLinkFake();
  const recentStore = new ProjectRecentStore(null);
  const consoleLog = new ConsoleLog();
  const consoleReporter = new ProjectWorkbenchConsoleReporter(() => consoleLog);
  const levelBuilder = new ControllerLevelBuild({
    worldGroup,
    gameProcessControlRead: () => control,
    levelNameRead: () => 'rig_level',
    glbExport: async () => new ArrayBuffer(0),
    issuesCollect: () => [],
  });
  const workbench = new ProjectWorkbench({
    control,
    link,
    worldGroup,
    recentStore,
    consoleReporter,
    levelBuilder,
    openLevelRead,
    ...(openLevelSave ? { openLevelSave } : {}),
  });
  return { control, link, worldGroup, recentStore, consoleLog, workbench };
}
