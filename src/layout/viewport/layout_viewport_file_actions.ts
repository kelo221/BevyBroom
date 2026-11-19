import type * as THREE from 'three';
import type { CommandStack } from '@/commands/command_stack.js';
import type { EditorSettingsStore } from '@/settings/store/editor_settings_store.js';
import type { SolidModelController } from '@/solid/controller/solid_model_controller.js';
import type { HandlerSceneIo } from '@/tools/io/handler_scene_io.js';
import type { StatusBar } from '@/ui/status/status_bar.js';
import type { GameProfile, KeyboardShortcut, KeyboardShortcutAction } from '@/settings/store/settings_types.js';
import {
  runLayoutExportFbx,
  runLayoutExportGlb,
  runLayoutExportObj,
  runLayoutNewScene,
  runLayoutObjImport,
  runLayoutVmfImport,
} from '@/layout/setup/layout_scene_io_actions.js';
import { formatKeyboardShortcut } from '@/settings/keyboard/keyboard_shortcut_format.js';
import { createDefaultKeyboardShortcutSettings } from '@/settings/store/settings_defaults.js';
import type { SystemSceneRecovery } from '@/scene_recovery/system_scene_recovery.js';
import { dialogSceneFileChangedOnDiskConfirm } from '@/io/dialog/dialog_scene_file_changed_on_disk.js';
import type { ProjectLevelActions } from '@/project/level/project_level_actions.js';

/** Current editor parts the File menu actions use. */
export interface LayoutViewportFileActionsContext {
  readonly toolbarContainer: HTMLElement;
  readonly sceneIOHandler: HandlerSceneIo;
  readonly worldObject: THREE.Group;
  readonly commandStack: CommandStack;
  readonly statusBar: StatusBar | null;
  readonly solidModelController: SolidModelController | null;
  readonly settingsStore: EditorSettingsStore | null;
  /** Creates the settings system when it does not exist yet. */
  ensureSettingsSystem(): void;
  /** Refreshes the editor after a scene was loaded or replaced. */
  onSceneLoaded(): void;
  /** Refreshes the editor after objects were added to the world. */
  refreshAfterWorldMutation(): void;
  /** Returns the unsaved work protection, or null before it exists. */
  sceneRecoveryRead(): SystemSceneRecovery | null;
  /** Returns the actions on the open project's levels. */
  projectLevelActionsRead(): ProjectLevelActions;
}

/**
 * File menu and file shortcut actions of the viewport layout: new, save, load,
 * import and export.
 */
export class LayoutViewportFileActions {
  private readonly contextRead: () => LayoutViewportFileActionsContext;

  /**
   * Creates the file actions.
   *
   * @param contextRead Returns the current editor parts; called on every
   *   action.
   */
  constructor(contextRead: () => LayoutViewportFileActionsContext) {
    this.contextRead = contextRead;
  }

  /**
   * Returns the current editor parts.
   *
   * @returns File actions context.
   */
  private get host(): LayoutViewportFileActionsContext {
    return this.contextRead();
  }

  /**
   * Starts a new scene: inside an open game project a new level that is named
   * and saved into the project's level folder at once, otherwise the startup
   * scene after confirming that unsaved work may be discarded.
   */
  sceneNew(): void {
    if (this.host.projectLevelActionsRead().projectOpenIs()) {
      void this.projectLevelNewRun();
      return;
    }
    const host = this.host;
    void runLayoutNewScene(
      host.toolbarContainer,
      host.sceneIOHandler,
      host.worldObject,
      host.commandStack,
      host.statusBar,
      host.solidModelController,
      () => this.sceneReplacedRefresh(),
    );
  }

  /**
   * Asks for a level name, then replaces the scene with a new project level
   * saved under that name.
   *
   * @returns The new level document, or null when nothing was created.
   */
  private async projectLevelNewRun(): Promise<string | null> {
    const levelActions = this.host.projectLevelActionsRead();
    const name = await levelActions.levelNameAsk('New Level', 'Create');
    if (name === null) {
      return null;
    }
    const created = await levelActions.levelNew(name, true);
    return created.ok ? created.level.document : null;
  }

  /**
   * Saves the scene back into the open project level when there is one, else to
   * its remembered file. Without either, inside an open game project it asks
   * for a level name and saves a new project level; outside one it asks for a
   * file. Overwriting a file another program changed is confirmed first.
   *
   * @returns The written file name or level document, or null when nothing was
   *   written.
   */
  async sceneSave(): Promise<string | null> {
    const host = this.host;
    const levelActions = host.projectLevelActionsRead();
    if (levelActions.serviceRead().openLevelRead() !== null) {
      const saved = await levelActions.levelSave(true);
      return saved.ok ? saved.level.document : null;
    }
    if (host.sceneIOHandler.sceneDocumentFileNameRead() === null && levelActions.projectOpenIs()) {
      return this.projectLevelSaveAsNewRun();
    }
    const fileName = await host.sceneIOHandler.saveScene(host.worldObject, host.statusBar, (changedFileName) =>
      dialogSceneFileChangedOnDiskConfirm(host.toolbarContainer, changedFileName),
    );
    this.savedStateAdoptWhenWritten(fileName);
    return fileName;
  }

  /**
   * Asks for a level name and saves the scene as a new project level.
   *
   * @returns The new level document, or null when nothing was written.
   */
  private async projectLevelSaveAsNewRun(): Promise<string | null> {
    const levelActions = this.host.projectLevelActionsRead();
    const name = await levelActions.levelNameAsk('Save Level', 'Save');
    if (name === null) {
      return null;
    }
    const saved = await levelActions.levelSaveAsNew(name);
    return saved.ok ? saved.level.document : null;
  }

  /**
   * Saves the scene to a newly chosen file as a new document. Inside an open
   * game project the file dialog starts in the project's level folder.
   *
   * @returns The written file name, or null when nothing was written.
   */
  async sceneSaveAs(): Promise<string | null> {
    const host = this.host;
    const startingDirectory = host.projectLevelActionsRead().serviceRead().listStateRead().documentDirectory;
    const fileName = await host.sceneIOHandler.saveSceneAs(host.worldObject, host.statusBar, startingDirectory);
    this.savedStateAdoptWhenWritten(fileName);
    return fileName;
  }

  /** Asks for a scene file and loads it. */
  sceneLoad(): void {
    const host = this.host;
    void host.sceneIOHandler.loadScene(host.worldObject, () => this.sceneReplacedRefresh(), host.statusBar);
  }

  /**
   * Refreshes the editor after New or Load replaced the scene, which starts out
   * saved and belongs to no project level.
   */
  private sceneReplacedRefresh(): void {
    this.host.onSceneLoaded();
    this.host.sceneRecoveryRead()?.savedStateAdopt();
    this.host.projectLevelActionsRead().serviceRead().openLevelForget();
  }

  /**
   * Counts the scene as saved once a save wrote its file.
   *
   * @param fileName The written file name, or null when nothing was written.
   */
  private savedStateAdoptWhenWritten(fileName: string | null): void {
    if (fileName !== null) {
      this.host.sceneRecoveryRead()?.savedStateAdopt();
    }
  }

  /** Exports the world as GLB with the active game profile. */
  exportGlb(): void {
    runLayoutExportGlb(this.host.sceneIOHandler, this.host.worldObject, this.host.statusBar, this.gameProfileRead());
  }

  /** Exports the world as Wavefront OBJ with the active game profile. */
  exportObj(): void {
    runLayoutExportObj(this.host.sceneIOHandler, this.host.worldObject, this.host.statusBar, this.gameProfileRead());
  }

  /** Exports the world as Autodesk FBX with the active game profile. */
  exportFbx(): void {
    runLayoutExportFbx(this.host.sceneIOHandler, this.host.worldObject, this.host.statusBar, this.gameProfileRead());
  }

  /** Asks for a VMF map and places it as a solid model. */
  importVmf(): void {
    const host = this.host;
    void runLayoutVmfImport(host.sceneIOHandler, host.statusBar, host.solidModelController, () =>
      host.refreshAfterWorldMutation(),
    );
  }

  /** Asks for a Wavefront OBJ file and places its meshes. */
  importObj(): void {
    const host = this.host;
    void runLayoutObjImport(host.sceneIOHandler, host.statusBar, host.worldObject, host.commandStack, () =>
      host.refreshAfterWorldMutation(),
    );
  }

  /**
   * Returns the configured keyboard shortcut text of an action.
   *
   * @param action Shortcut action.
   * @returns Shortcut text such as "Ctrl+S".
   */
  shortcutLabelRead(action: KeyboardShortcutAction): string {
    return formatKeyboardShortcut(this.shortcutBindingRead(action));
  }

  /**
   * Returns the configured key and modifiers of an action.
   *
   * @param action Shortcut action.
   * @returns Shortcut binding.
   */
  shortcutBindingRead(action: KeyboardShortcutAction): KeyboardShortcut {
    const settings = this.host.settingsStore?.getKeyboardShortcutSettings() ?? createDefaultKeyboardShortcutSettings();
    return settings[action];
  }

  /**
   * Returns the active game profile.
   *
   * @returns Active game profile, or null when none is configured.
   */
  private gameProfileRead(): GameProfile | null {
    this.host.ensureSettingsSystem();
    return this.host.settingsStore?.getActiveGameProfile() ?? null;
  }
}
