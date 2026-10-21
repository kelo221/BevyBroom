import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DESKTOP_PROFILE_MIGRATION_LEGACY_IDENTIFIER,
  DESKTOP_PROFILE_MIGRATION_WEBVIEW_FOLDER_NAME,
  desktopProfileMigrationCurrentFolderPath,
  desktopProfileMigrationLegacyFolderPath,
  desktopProfileMigrationRun,
} from '@/desktop/desktop_profile_migration_legacy.js';

const temporaryFolders: string[] = [];

/**
 * Creates an empty app data folder and returns a current user data path inside
 * it, using a made-up identifier and install root name.
 *
 * @returns App data folder and the user data folder under it.
 */
function appDataFolderCreate(): { appDataPath: string; userDataPath: string } {
  const appDataPath = mkdtempSync(join(tmpdir(), 'desktop_profile_migration_'));
  temporaryFolders.push(appDataPath);
  return { appDataPath, userDataPath: join(appDataPath, 'com.example.renamed', 'channel_root') };
}

/**
 * Writes a file into a folder, creating the folder first.
 *
 * @param folderPath Folder to hold the file.
 * @param fileName File name.
 * @param text File content.
 */
function fileInFolderWrite(folderPath: string, fileName: string, text: string): void {
  mkdirSync(folderPath, { recursive: true });
  writeFileSync(join(folderPath, fileName), text);
}

afterEach(() => {
  for (const folder of temporaryFolders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

describe('desktopProfileMigrationLegacyFolderPath', () => {
  it('points at the legacy identifier with the same install root name', () => {
    const { appDataPath, userDataPath } = appDataFolderCreate();
    expect(desktopProfileMigrationLegacyFolderPath(userDataPath)).toBe(
      join(
        appDataPath,
        DESKTOP_PROFILE_MIGRATION_LEGACY_IDENTIFIER,
        'channel_root',
        DESKTOP_PROFILE_MIGRATION_WEBVIEW_FOLDER_NAME,
      ),
    );
    expect(desktopProfileMigrationCurrentFolderPath(userDataPath)).toBe(
      join(userDataPath, DESKTOP_PROFILE_MIGRATION_WEBVIEW_FOLDER_NAME),
    );
  });
});

describe('desktopProfileMigrationRun', () => {
  it('moves the legacy profile with its contents and removes the emptied legacy folders', () => {
    const { appDataPath, userDataPath } = appDataFolderCreate();
    fileInFolderWrite(desktopProfileMigrationLegacyFolderPath(userDataPath), 'Local State', 'legacy settings');

    expect(desktopProfileMigrationRun(userDataPath, 'win32')).toBe('moved');
    expect(readFileSync(join(desktopProfileMigrationCurrentFolderPath(userDataPath), 'Local State'), 'utf8')).toBe(
      'legacy settings',
    );
    expect(existsSync(join(appDataPath, DESKTOP_PROFILE_MIGRATION_LEGACY_IDENTIFIER))).toBe(false);
  });

  it('keeps legacy folders that still hold other files, such as an installed app', () => {
    const { appDataPath, userDataPath } = appDataFolderCreate();
    const legacyFolderPath = desktopProfileMigrationLegacyFolderPath(userDataPath);
    fileInFolderWrite(legacyFolderPath, 'Local State', 'legacy settings');
    fileInFolderWrite(join(legacyFolderPath, '..'), 'launcher.exe', 'installed app');

    expect(desktopProfileMigrationRun(userDataPath, 'win32')).toBe('moved');
    expect(existsSync(legacyFolderPath)).toBe(false);
    expect(
      existsSync(join(appDataPath, DESKTOP_PROFILE_MIGRATION_LEGACY_IDENTIFIER, 'channel_root', 'launcher.exe')),
    ).toBe(true);
  });

  it('leaves both profiles alone when the current profile already exists', () => {
    const { userDataPath } = appDataFolderCreate();
    fileInFolderWrite(desktopProfileMigrationLegacyFolderPath(userDataPath), 'Local State', 'legacy settings');
    fileInFolderWrite(desktopProfileMigrationCurrentFolderPath(userDataPath), 'Local State', 'current settings');

    expect(desktopProfileMigrationRun(userDataPath, 'win32')).toBe('current_profile_exists');
    expect(readFileSync(join(desktopProfileMigrationCurrentFolderPath(userDataPath), 'Local State'), 'utf8')).toBe(
      'current settings',
    );
    expect(existsSync(desktopProfileMigrationLegacyFolderPath(userDataPath))).toBe(true);
  });

  it('reports a missing legacy profile and does nothing off Windows', () => {
    const { userDataPath } = appDataFolderCreate();
    expect(desktopProfileMigrationRun(userDataPath, 'win32')).toBe('no_legacy_profile');
    fileInFolderWrite(desktopProfileMigrationLegacyFolderPath(userDataPath), 'Local State', 'legacy settings');
    expect(desktopProfileMigrationRun(userDataPath, 'linux')).toBe('not_windows');
    expect(existsSync(desktopProfileMigrationCurrentFolderPath(userDataPath))).toBe(false);
  });

  it('runs in the desktop main process before the window is created', () => {
    const entry = readFileSync('src/desktop/bun/index.ts', 'utf8');
    const migrationIndex = entry.indexOf('desktopProfileMigrationRun(Utils.paths.userData, process.platform)');
    expect(migrationIndex).toBeGreaterThan(-1);
    expect(migrationIndex).toBeLessThan(entry.indexOf('new BrowserWindow('));
  });
});
