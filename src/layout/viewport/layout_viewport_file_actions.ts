import type * as THREE from 'three';
import type { CommandStack } from '@/commands/command_stack.js';
import type { EditorSettingsStore } from '@/settings/store/editor_settings_store.js';
import type { SolidModelController } from '@/solid/controller/solid_model_controller.js';
import type { HandlerSceneIo } from '@/tools/io/handler_scene_io.js';
import type { StatusBar } from '@/ui/status/status_bar.js';
import type { GameProfile, KeyboardShortcutAction } from '@/settings/store/settings_types.js';
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

  /** Confirms discarding the scene, then restores the startup scene. */
  sceneNew(): void {
    const host = this.host;
    void runLayoutNewScene(
      host.toolbarContainer,
      host.sceneIOHandler,
      host.worldObject,
      host.commandStack,
      host.statusBar,
      host.solidModelController,
      () => host.onSceneLoaded(),
    );
  }

  /**
   * Saves the scene to its remembered file, asking for one when none is
   * remembered.
   */
  sceneSave(): void {
    void this.host.sceneIOHandler.saveScene(this.host.worldObject, this.host.statusBar);
  }

  /** Saves the scene to a newly chosen file as a new document. */
  sceneSaveAs(): void {
    void this.host.sceneIOHandler.saveSceneAs(this.host.worldObject, this.host.statusBar);
  }

  /** Asks for a scene file and loads it. */
  sceneLoad(): void {
    const host = this.host;
    void host.sceneIOHandler.loadScene(host.worldObject, () => host.onSceneLoaded(), host.statusBar);
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
    const settings = this.host.settingsStore?.getKeyboardShortcutSettings() ?? createDefaultKeyboardShortcutSettings();
    return formatKeyboardShortcut(settings[action]);
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
