import type * as THREE from 'three';
import type { CommandStack } from '@/commands/command_stack.js';
import type { HandlerSceneIo } from '@/tools/io/handler_scene_io.js';
import type { StatusBar } from '@/ui/status/status_bar.js';
import { ConsoleLog } from '@/info_panel/console/console_log.js';
import { ControllerSceneRecovery } from '@/scene_recovery/controller_scene_recovery.js';
import { TrackerDocumentUnsavedChanges } from '@/scene_recovery/tracker/tracker_document_unsaved_changes.js';
import type { SceneRecoveryStore } from '@/scene_recovery/store/scene_recovery_store.js';
import {
  SceneRecoveryStoreWebStorage,
  sceneRecoveryLocalStorageRead,
} from '@/scene_recovery/store/scene_recovery_store_web_storage.js';
import type { SceneRecoverySnapshot } from '@/scene_recovery/snapshot/scene_recovery_snapshot.js';
import {
  sceneRecoveryRestoreOffer,
  type SceneRecoveryRestoreOfferOptions,
  type SceneRecoveryRestoreOutcome,
} from '@/scene_recovery/scene_recovery_restore_offer.js';

/** Editor parts scene recovery works with. */
export interface SystemSceneRecoveryDeps {
  /** Element that owns the restore dialog. */
  host: HTMLElement;
  /** History of the document. */
  commandStack: CommandStack;
  /** Scene root. */
  worldObject: THREE.Group;
  /** Serializes and loads scenes. */
  sceneIOHandler: HandlerSceneIo;
  /** Status bar for the unsaved marker and messages, or null. */
  statusBar: StatusBar | null;
  /** Refreshes the editor after a scene was loaded. */
  onSceneLoaded: () => void;
  /** Store for the recovery snapshot; defaults to the window's local storage. */
  store?: SceneRecoveryStore;
  /** Window whose closing flushes a pending autosave, or null for none. */
  windowObject?: Window | null;
  /** Wait between an edit and its autosave, for tests. */
  autosaveDelayMilliseconds?: number;
}

/**
 * Protects unsaved work: marks the scene as unsaved in the status bar,
 * autosaves it for recovery, writes a pending autosave when the window closes,
 * and offers kept work back when the editor starts.
 */
export class SystemSceneRecovery {
  readonly tracker: TrackerDocumentUnsavedChanges;
  readonly controller: ControllerSceneRecovery;
  private readonly deps: SystemSceneRecoveryDeps;
  private readonly store: SceneRecoveryStore;
  private readonly pageHideListener = (): void => this.controller.autosaveFlush();

  /**
   * Starts tracking and autosaving the document.
   *
   * @param deps Editor parts scene recovery works with.
   */
  constructor(deps: SystemSceneRecoveryDeps) {
    this.deps = deps;
    this.store = deps.store ?? new SceneRecoveryStoreWebStorage(sceneRecoveryLocalStorageRead());
    this.tracker = new TrackerDocumentUnsavedChanges(deps.commandStack);
    this.controller = this.controllerCreate();
    this.tracker.onUnsavedChangesChanged((isUnsaved) => deps.statusBar?.setUnsavedChanges(isUnsaved));
    this.windowObjectRead()?.addEventListener('pagehide', this.pageHideListener);
  }

  /**
   * Offers work kept from an earlier session back to the user.
   *
   * @param messageBoxShow Shows the question; defaults to the editor's message
   *   box.
   * @returns What happened to the kept work.
   */
  restoreOffer(
    messageBoxShow?: SceneRecoveryRestoreOfferOptions['messageBoxShow'],
  ): Promise<SceneRecoveryRestoreOutcome> {
    return sceneRecoveryRestoreOffer({
      host: this.deps.host,
      store: this.store,
      restore: (snapshot) => this.snapshotRestore(snapshot),
      ...(messageBoxShow === undefined ? {} : { messageBoxShow }),
    });
  }

  /** Counts the current document as saved, for after Save, New and Load. */
  savedStateAdopt(): void {
    this.controller.savedStateAdopt();
  }

  /** Stops tracking and autosaving. */
  dispose(): void {
    this.windowObjectRead()?.removeEventListener('pagehide', this.pageHideListener);
    this.controller.dispose();
    this.tracker.dispose();
  }

  /**
   * Creates the autosave controller.
   *
   * @returns Controller bound to this system's tracker and store.
   */
  private controllerCreate(): ControllerSceneRecovery {
    const deps = this.deps;
    return new ControllerSceneRecovery({
      commandStack: deps.commandStack,
      tracker: this.tracker,
      store: this.store,
      sceneJsonBuild: () => deps.sceneIOHandler.sceneJsonBuild(deps.worldObject),
      documentFileNameRead: () => deps.sceneIOHandler.sceneDocumentFileNameRead(),
      autosaveFailureReport: (message) => ConsoleLog.shared().entryAppendWarning(message),
      ...(deps.autosaveDelayMilliseconds === undefined
        ? {}
        : { autosaveDelayMilliseconds: deps.autosaveDelayMilliseconds }),
    });
  }

  /**
   * Loads kept work as an unsaved document.
   *
   * @param snapshot Kept work.
   * @returns True when the scene loaded.
   */
  private snapshotRestore(snapshot: SceneRecoverySnapshot): boolean {
    const deps = this.deps;
    if (
      !deps.sceneIOHandler.loadSceneFromText(snapshot.sceneJson, deps.worldObject, deps.onSceneLoaded, deps.statusBar)
    ) {
      return false;
    }
    this.controller.restoredStateAdopt();
    const fileName = snapshot.documentFileName ?? 'untitled scene';
    deps.statusBar?.setLastAction(`Restored unsaved work of ${fileName}; save it to keep it`);
    return true;
  }

  /**
   * Returns the window whose closing flushes a pending autosave.
   *
   * @returns The window, or null when there is none.
   */
  private windowObjectRead(): Window | null {
    if (this.deps.windowObject !== undefined) {
      return this.deps.windowObject;
    }
    return typeof window === 'undefined' ? null : window;
  }
}
