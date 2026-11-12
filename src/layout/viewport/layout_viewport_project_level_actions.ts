import type * as THREE from 'three';
import type { CommandStack } from '@/commands/command_stack.js';
import type { SolidModelController } from '@/solid/controller/solid_model_controller.js';
import type { HandlerSceneIo } from '@/tools/io/handler_scene_io.js';
import type { StatusBar } from '@/ui/status/status_bar.js';
import type { SystemSceneRecovery } from '@/scene_recovery/system_scene_recovery.js';
import { layoutSceneDiscardConfirm, runLayoutSceneReset } from '@/layout/setup/layout_scene_io_actions.js';
import { dialogSceneFileChangedOnDiskConfirm } from '@/io/dialog/dialog_scene_file_changed_on_disk.js';
import type { ProjectLevelActions, ProjectLevelOpenResult } from '@/project/level/project_level_actions.js';
import type { ProjectLevelService } from '@/project/level/project_level_service.js';
import type { ProjectLevelSummary, ProjectLevelWriteResult } from '@/project/level/project_level_types.js';

/** Current editor parts the project level actions use. */
export interface LayoutViewportProjectLevelActionsContext {
  readonly toolbarContainer: HTMLElement;
  readonly sceneIOHandler: HandlerSceneIo;
  readonly worldObject: THREE.Group;
  readonly commandStack: CommandStack;
  readonly statusBar: StatusBar | null;
  readonly solidModelController: SolidModelController | null;
  /**
   * Returns the service that lists the project's levels, creating it on first
   * use.
   */
  serviceRead(): ProjectLevelService;
  /** Refreshes the editor after a scene was loaded or replaced. */
  onSceneLoaded(): void;
  /** Returns the unsaved work protection, or null before it exists. */
  sceneRecoveryRead(): SystemSceneRecovery | null;
  /**
   * Shows the Level Browser window.
   *
   * @param isNameFieldFocused True to focus its name field.
   */
  levelBrowserReveal(isNameFieldFocused: boolean): void;
}

/**
 * Project level actions of the viewport layout: open a level document into the
 * editor, save the scene back into it, save it as a new level, start a new
 * level and rename levels, keeping the unsaved-work protection in step.
 */
export class LayoutViewportProjectLevelActions implements ProjectLevelActions {
  private readonly contextRead: () => LayoutViewportProjectLevelActionsContext;

  /**
   * Creates the actions.
   *
   * @param contextRead Returns the current editor parts; called on every
   *   action.
   */
  constructor(contextRead: () => LayoutViewportProjectLevelActionsContext) {
    this.contextRead = contextRead;
  }

  /**
   * Returns the current editor parts.
   *
   * @returns Actions context.
   */
  private get host(): LayoutViewportProjectLevelActionsContext {
    return this.contextRead();
  }

  /** @inheritdoc */
  serviceRead(): ProjectLevelService {
    return this.host.serviceRead();
  }

  /** @inheritdoc */
  async levelOpen(document: string, isDiscardConfirmed: boolean): Promise<ProjectLevelOpenResult> {
    if (isDiscardConfirmed && !(await this.discardConfirm('Open Level', 'open another level'))) {
      return { ok: false, message: 'Opening the level was cancelled.' };
    }
    const read = await this.serviceRead().documentRead(document);
    if (!read.ok) {
      return this.failureShow(read.message);
    }
    const host = this.host;
    const isLoaded = host.sceneIOHandler.loadSceneFromText(
      read.text,
      host.worldObject,
      () => host.onSceneLoaded(),
      host.statusBar,
    );
    return isLoaded
      ? this.openedLevelAdopt(read.level)
      : this.failureShow(`Level "${read.level.name}" is not a scene document.`);
  }

  /** @inheritdoc */
  async levelSave(isOverwriteAsked: boolean): Promise<ProjectLevelWriteResult> {
    const service = this.serviceRead();
    const written = await service.openLevelWrite(this.sceneJsonRead(), false);
    if (written.ok || written.refusal !== 'changed_on_disk' || !isOverwriteAsked) {
      return this.writeResultShow(written);
    }
    const levelName = service.openLevelRead()?.name ?? 'the level';
    if (!(await dialogSceneFileChangedOnDiskConfirm(this.host.toolbarContainer, levelName))) {
      return this.failureShow(`Save cancelled: ${levelName} was changed by another program.`);
    }
    return this.writeResultShow(await service.openLevelWrite(this.sceneJsonRead(), true));
  }

  /** @inheritdoc */
  async levelSaveAsNew(name: string): Promise<ProjectLevelWriteResult> {
    return this.writeResultShow(await this.serviceRead().levelCreate(name, this.sceneJsonRead()));
  }

  /** @inheritdoc */
  async levelNew(name: string, isDiscardConfirmed: boolean): Promise<ProjectLevelWriteResult> {
    if (name.trim() === '') {
      return this.failureShow('Type a name for the new level.');
    }
    if (!(await this.sceneReset(isDiscardConfirmed))) {
      return { ok: false, message: 'Creating the level was cancelled.' };
    }
    this.serviceRead().openLevelForget();
    return this.levelSaveAsNew(name);
  }

  /** @inheritdoc */
  async levelRename(document: string, name: string): Promise<ProjectLevelWriteResult> {
    const renamed = await this.serviceRead().levelRename(document, name);
    if (!renamed.ok) {
      return this.failureShow(renamed.message);
    }
    this.host.statusBar?.setLastAction(`Renamed level to ${renamed.level.name}`);
    return renamed;
  }

  /** @inheritdoc */
  levelBrowserReveal(isNameFieldFocused: boolean): void {
    this.host.levelBrowserReveal(isNameFieldFocused);
  }

  /**
   * Replaces the scene with the startup scene, asking first when wanted.
   *
   * @param isDiscardConfirmed True to ask before unsaved work is replaced.
   * @returns True when the scene was reset.
   */
  private async sceneReset(isDiscardConfirmed: boolean): Promise<boolean> {
    if (isDiscardConfirmed && !(await this.discardConfirm('New Level', 'create a new level'))) {
      return false;
    }
    const host = this.host;
    runLayoutSceneReset(host.sceneIOHandler, host.worldObject, host.statusBar, host.solidModelController, () =>
      this.sceneReplacedRefresh(),
    );
    return true;
  }

  /**
   * Asks whether unsaved work may be replaced.
   *
   * @param title Dialog title.
   * @param purpose What the user is about to do, finishing "Are you sure you
   *   want to …".
   * @returns True when the scene may be replaced.
   */
  private discardConfirm(title: string, purpose: string): Promise<boolean> {
    const host = this.host;
    return layoutSceneDiscardConfirm(host.toolbarContainer, host.sceneIOHandler, host.worldObject, host.commandStack, {
      title,
      message: `Are you sure you want to ${purpose}?\n\nAny unsaved changes will be permanently lost.`,
    });
  }

  /**
   * Makes a loaded level the open level and counts the scene as saved.
   *
   * @param level Level whose document was loaded.
   * @returns Success naming the level.
   */
  private openedLevelAdopt(level: ProjectLevelSummary): ProjectLevelOpenResult {
    this.serviceRead().openLevelAdopt(level);
    this.host.sceneRecoveryRead()?.savedStateAdopt();
    this.host.statusBar?.setLastSavedInfo(level.document);
    this.host.statusBar?.setLastAction(`Opened level ${level.name}`);
    return { ok: true, level };
  }

  /** Refreshes the editor after the scene was replaced, which starts out saved. */
  private sceneReplacedRefresh(): void {
    this.host.onSceneLoaded();
    this.host.sceneRecoveryRead()?.savedStateAdopt();
  }

  /**
   * Serializes the open scene.
   *
   * @returns Scene document text.
   */
  private sceneJsonRead(): string {
    return this.host.sceneIOHandler.sceneJsonBuild(this.host.worldObject);
  }

  /**
   * Reports a write in the status bar and counts the scene as saved on success.
   *
   * @param result Outcome of a write.
   * @returns The same outcome.
   */
  private writeResultShow(result: ProjectLevelWriteResult): ProjectLevelWriteResult {
    if (!result.ok) {
      this.host.statusBar?.setErrorText(result.message);
      return result;
    }
    this.host.sceneRecoveryRead()?.savedStateAdopt();
    this.host.statusBar?.setLastSavedInfo(result.level.document);
    this.host.statusBar?.setLastAction(`Saved level ${result.level.name}`);
    return result;
  }

  /**
   * Shows a failure in the status bar.
   *
   * @param message Failure message.
   * @returns Failure result.
   */
  private failureShow(message: string): { ok: false; message: string } {
    this.host.statusBar?.setErrorText(message);
    return { ok: false, message };
  }
}
