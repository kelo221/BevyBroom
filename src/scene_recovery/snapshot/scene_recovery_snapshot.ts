/** Version of the recovery snapshot format this editor writes and reads. */
export const SCENE_RECOVERY_SNAPSHOT_VERSION = 1;

/** Unsaved scene kept so work survives the editor closing unexpectedly. */
export interface SceneRecoverySnapshot {
  /** Snapshot format version. */
  version: number;
  /** Time the snapshot was taken, in milliseconds since the Unix epoch. */
  savedAtMilliseconds: number;
  /** Name of the scene file the work belongs to, or null for an untitled scene. */
  documentFileName: string | null;
  /** Complete scene document text. */
  sceneJson: string;
}

/**
 * Builds a snapshot of the current format.
 *
 * @param sceneJson Complete scene document text.
 * @param documentFileName Scene file name, or null for an untitled scene.
 * @param savedAtMilliseconds Time the snapshot is taken.
 * @returns The snapshot.
 */
export function sceneRecoverySnapshotCreate(
  sceneJson: string,
  documentFileName: string | null,
  savedAtMilliseconds: number,
): SceneRecoverySnapshot {
  return { version: SCENE_RECOVERY_SNAPSHOT_VERSION, savedAtMilliseconds, documentFileName, sceneJson };
}

/**
 * Parses stored snapshot text, refusing anything that is not a complete
 * snapshot of the current format.
 *
 * @param text Stored snapshot text.
 * @returns The snapshot, or null when the text is not a usable snapshot.
 */
export function sceneRecoverySnapshotParse(text: string): SceneRecoverySnapshot | null {
  try {
    const value: unknown = JSON.parse(text);
    return sceneRecoverySnapshotIsValid(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * Returns whether a parsed value is a complete snapshot of the current format.
 *
 * @param value Parsed value.
 * @returns True when every snapshot field has the right type.
 */
function sceneRecoverySnapshotIsValid(value: unknown): value is SceneRecoverySnapshot {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  const fileName = record['documentFileName'];
  return (
    record['version'] === SCENE_RECOVERY_SNAPSHOT_VERSION &&
    typeof record['savedAtMilliseconds'] === 'number' &&
    (fileName === null || typeof fileName === 'string') &&
    typeof record['sceneJson'] === 'string'
  );
}
