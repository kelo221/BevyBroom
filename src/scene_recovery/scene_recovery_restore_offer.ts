import { showMessageBox, type MessageBoxOptions } from '@/ui/dialog/dialog_message_box.js';
import type { SceneRecoverySnapshot } from '@/scene_recovery/snapshot/scene_recovery_snapshot.js';
import type { SceneRecoveryStore } from '@/scene_recovery/store/scene_recovery_store.js';

/** What the restore offer works with. */
export interface SceneRecoveryRestoreOfferOptions {
  /** Element that owns the dialog. */
  host: HTMLElement;
  /** Store holding the recovery snapshot. */
  store: SceneRecoveryStore;
  /**
   * Loads a snapshot into the editor.
   *
   * @returns True when the scene loaded.
   */
  restore: (snapshot: SceneRecoverySnapshot) => boolean;
  /** Shows the question; defaults to the editor's message box. */
  messageBoxShow?: (options: MessageBoxOptions) => Promise<boolean>;
}

/** What happened to a recovery snapshot offered at startup. */
export type SceneRecoveryRestoreOutcome = 'none' | 'restored' | 'discarded' | 'failed';

/**
 * Asks whether to restore unsaved work kept from an earlier session. Restore
 * loads it as an unsaved document; Discard deletes the snapshot. A snapshot
 * that does not load is kept so it is not lost.
 *
 * @param options Dialog host, store and restore action.
 * @returns What happened to the snapshot.
 */
export async function sceneRecoveryRestoreOffer(
  options: SceneRecoveryRestoreOfferOptions,
): Promise<SceneRecoveryRestoreOutcome> {
  const snapshot = options.store.snapshotRead();
  if (snapshot === null) {
    return 'none';
  }
  const show = options.messageBoxShow ?? showMessageBox;
  if (!(await show(sceneRecoveryRestoreMessageBuild(options.host, snapshot)))) {
    options.store.snapshotClear();
    return 'discarded';
  }
  return options.restore(snapshot) ? 'restored' : 'failed';
}

/**
 * Builds the restore question for a snapshot.
 *
 * @param host Element that owns the dialog.
 * @param snapshot Snapshot being offered.
 * @returns Message box options.
 */
export function sceneRecoveryRestoreMessageBuild(
  host: HTMLElement,
  snapshot: SceneRecoverySnapshot,
): MessageBoxOptions {
  const documentName = snapshot.documentFileName ?? 'an untitled scene';
  const savedAt = new Date(snapshot.savedAtMilliseconds).toLocaleString();
  return {
    host,
    title: 'Recover Unsaved Work',
    message: `The editor closed with unsaved changes to ${documentName}, autosaved ${savedAt}.\n\nRestore them now?`,
    boldMessage: 'Discard deletes the autosaved copy permanently.',
    confirmLabel: 'Restore',
    cancelLabel: 'Discard',
  };
}
