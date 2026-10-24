import type { CommandStack } from '@/commands/command_stack.js';
import { sceneRecoverySnapshotCreate } from '@/scene_recovery/snapshot/scene_recovery_snapshot.js';
import type { SceneRecoveryStore } from '@/scene_recovery/store/scene_recovery_store.js';
import type { TrackerDocumentUnsavedChanges } from '@/scene_recovery/tracker/tracker_document_unsaved_changes.js';

/** Default wait between an edit and the autosave that follows it. */
export const SCENE_RECOVERY_AUTOSAVE_DELAY_MILLISECONDS = 15000;

/** Editor parts the recovery controller works with. */
export interface ControllerSceneRecoveryDeps {
  /** History of the document. */
  commandStack: CommandStack;
  /** Tells whether the document has unsaved changes. */
  tracker: TrackerDocumentUnsavedChanges;
  /** Keeps the recovery snapshot. */
  store: SceneRecoveryStore;
  /** Serializes the current scene. */
  sceneJsonBuild: () => string;
  /** Returns the scene file name, or null for an untitled scene. */
  documentFileNameRead: () => string | null;
  /** Reports an autosave that could not be written. */
  autosaveFailureReport: (message: string) => void;
  /** Wait between an edit and its autosave; defaults to fifteen seconds. */
  autosaveDelayMilliseconds?: number;
  /** Returns the current time in milliseconds; defaults to Date.now. */
  clockRead?: () => number;
}

/**
 * Autosaves unsaved work into the recovery store a short while after each edit,
 * and removes the recovery snapshot once the document is saved or replaced, so
 * only work that would otherwise be lost is ever offered back.
 */
export class ControllerSceneRecovery {
  private readonly deps: ControllerSceneRecoveryDeps;
  private autosaveTimer: ReturnType<typeof setTimeout> | null = null;
  private lastReportedFailure: string | null = null;
  private readonly stackChangedListener = (): void => this.documentChangedHandle();

  /**
   * Starts watching the document history.
   *
   * @param deps Editor parts the controller works with.
   */
  constructor(deps: ControllerSceneRecoveryDeps) {
    this.deps = deps;
    deps.commandStack.onStackChanged(this.stackChangedListener);
  }

  /** Counts the current document as saved and removes the recovery snapshot. */
  savedStateAdopt(): void {
    this.deps.tracker.savedPointMark();
    this.autosavePendingCancel();
    this.deps.store.snapshotClear();
  }

  /**
   * Counts a restored document as unsaved until it is saved, and keeps its
   * snapshot.
   */
  restoredStateAdopt(): void {
    this.deps.tracker.savedPointForget();
    this.autosaveRun();
  }

  /** Writes a pending autosave right away, for when the editor is closing. */
  autosaveFlush(): void {
    if (this.autosaveTimer !== null) {
      this.autosaveRun();
    }
  }

  /**
   * Returns whether an autosave is waiting to be written.
   *
   * @returns True while an autosave is scheduled.
   */
  isAutosavePending(): boolean {
    return this.autosaveTimer !== null;
  }

  /** Stops watching the history and drops any pending autosave. */
  dispose(): void {
    this.deps.commandStack.offStackChanged(this.stackChangedListener);
    this.autosavePendingCancel();
  }

  /**
   * Schedules an autosave after an edit, or forgets the snapshot once saved
   * again.
   */
  private documentChangedHandle(): void {
    if (this.deps.tracker.hasUnsavedChanges()) {
      this.autosaveSchedule();
      return;
    }
    this.autosavePendingCancel();
    this.deps.store.snapshotClear();
  }

  /** Schedules one autosave unless one is already waiting. */
  private autosaveSchedule(): void {
    if (this.autosaveTimer !== null) {
      return;
    }
    const delay = this.deps.autosaveDelayMilliseconds ?? SCENE_RECOVERY_AUTOSAVE_DELAY_MILLISECONDS;
    this.autosaveTimer = setTimeout(() => this.autosaveRun(), delay);
  }

  /** Drops a waiting autosave. */
  private autosavePendingCancel(): void {
    if (this.autosaveTimer !== null) {
      clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    }
  }

  /** Writes the snapshot of the current scene while it has unsaved changes. */
  private autosaveRun(): void {
    this.autosavePendingCancel();
    if (!this.deps.tracker.hasUnsavedChanges()) {
      return;
    }
    const now = (this.deps.clockRead ?? Date.now)();
    const snapshot = sceneRecoverySnapshotCreate(this.deps.sceneJsonBuild(), this.deps.documentFileNameRead(), now);
    const result = this.deps.store.snapshotWrite(snapshot);
    this.autosaveFailureReportOnce(result.ok ? null : result.message);
  }

  /**
   * Reports an autosave failure once until autosaving works again.
   *
   * @param failureMessage Reason of the failure, or null when the write worked.
   */
  private autosaveFailureReportOnce(failureMessage: string | null): void {
    if (failureMessage !== null && failureMessage !== this.lastReportedFailure) {
      this.deps.autosaveFailureReport(`Autosave failed, unsaved work is not protected: ${failureMessage}`);
    }
    this.lastReportedFailure = failureMessage;
  }
}
