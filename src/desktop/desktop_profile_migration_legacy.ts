import { existsSync, mkdirSync, readdirSync, renameSync, rmdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

/** Application identifier the desktop app used before it was renamed. */
export const DESKTOP_PROFILE_MIGRATION_LEGACY_IDENTIFIER = 'com.henry00is.aiworlded';

/** Name of the WebView2 profile folder inside an app's user data folder. */
export const DESKTOP_PROFILE_MIGRATION_WEBVIEW_FOLDER_NAME = 'WebView2';

/** What happened when the legacy profile move was attempted. */
export type DesktopProfileMigrationOutcome =
  'moved' | 'not_windows' | 'no_legacy_profile' | 'current_profile_exists' | 'failed';

/**
 * Builds the legacy WebView2 profile path that sits beside the current user
 * data folder, under the legacy identifier and the same install root name.
 *
 * @param userDataPath Current user data folder
 *   (`<appData>/<identifier>/<rootName>`).
 * @returns Legacy WebView2 profile folder.
 */
export function desktopProfileMigrationLegacyFolderPath(userDataPath: string): string {
  const appDataPath = dirname(dirname(userDataPath));
  return join(
    appDataPath,
    DESKTOP_PROFILE_MIGRATION_LEGACY_IDENTIFIER,
    basename(userDataPath),
    DESKTOP_PROFILE_MIGRATION_WEBVIEW_FOLDER_NAME,
  );
}

/**
 * Builds the current WebView2 profile path inside the user data folder.
 *
 * @param userDataPath Current user data folder.
 * @returns Current WebView2 profile folder.
 */
export function desktopProfileMigrationCurrentFolderPath(userDataPath: string): string {
  return join(userDataPath, DESKTOP_PROFILE_MIGRATION_WEBVIEW_FOLDER_NAME);
}

/**
 * Moves the legacy WebView2 profile, which holds the page's saved settings,
 * into the current user data folder once. Nothing happens off Windows, without
 * a legacy profile, or when a current profile already exists.
 *
 * @param userDataPath Current user data folder.
 * @param platform Node platform name of the running process.
 * @returns What happened.
 */
export function desktopProfileMigrationRun(
  userDataPath: string,
  platform: NodeJS.Platform,
): DesktopProfileMigrationOutcome {
  if (platform !== 'win32') {
    return 'not_windows';
  }
  const legacyFolderPath = desktopProfileMigrationLegacyFolderPath(userDataPath);
  const currentFolderPath = desktopProfileMigrationCurrentFolderPath(userDataPath);
  if (!existsSync(legacyFolderPath)) {
    return 'no_legacy_profile';
  }
  if (existsSync(currentFolderPath)) {
    return 'current_profile_exists';
  }
  return desktopProfileMigrationFolderMove(legacyFolderPath, currentFolderPath);
}

/**
 * Renames the legacy profile folder to the current one, then removes the legacy
 * parent folders that became empty.
 *
 * @param legacyFolderPath Existing legacy WebView2 profile folder.
 * @param currentFolderPath Current WebView2 profile folder, which must not
 *   exist yet.
 * @returns `moved`, or `failed` when the file system refused the rename.
 */
function desktopProfileMigrationFolderMove(
  legacyFolderPath: string,
  currentFolderPath: string,
): DesktopProfileMigrationOutcome {
  try {
    mkdirSync(dirname(currentFolderPath), { recursive: true });
    renameSync(legacyFolderPath, currentFolderPath);
  } catch {
    return 'failed';
  }
  const legacyRootFolderPath = dirname(legacyFolderPath);
  desktopProfileMigrationFolderRemoveIfEmpty(legacyRootFolderPath);
  desktopProfileMigrationFolderRemoveIfEmpty(dirname(legacyRootFolderPath));
  return 'moved';
}

/**
 * Removes a folder only when it exists and holds nothing.
 *
 * @param folderPath Folder to remove.
 */
function desktopProfileMigrationFolderRemoveIfEmpty(folderPath: string): void {
  if (existsSync(folderPath) && readdirSync(folderPath).length === 0) {
    rmdirSync(folderPath);
  }
}
