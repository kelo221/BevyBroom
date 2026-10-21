import { describe, expect, it } from 'vitest';
import { selectStandaloneUpdateAsset } from '@/updater/update_asset_selector.js';
import type { GitHubReleaseAsset } from '@/updater/update_types.js';

describe('standalone update asset selection', () => {
  it('selects the Windows installer and ignores checksums and source archives', () => {
    const assets = createAssets(
      'BevyBroom-windows-portable.exe',
      'BevyBroom-windows-installer.exe',
      'BevyBroom-linux.AppImage',
      'BevyBroom-sha256.txt',
      'BevyBroom-source.zip',
    );
    expect(selectStandaloneUpdateAsset(assets, 'windows')?.name).toBe('BevyBroom-windows-installer.exe');
  });

  it('prefers versioned Setup zips over portable update tarballs on Windows', () => {
    const assets = createAssets(
      'stable-win-x64-BevyBroom.tar.zst',
      'BevyBroom-1.0.42-Win-x64-Setup.zip',
      'stable-win-x64-update.json',
      'stable-win-x64-1a42wpx0i4p0k.patch',
    );
    expect(selectStandaloneUpdateAsset(assets, 'windows')?.name).toBe('BevyBroom-1.0.42-Win-x64-Setup.zip');
  });

  it('selects native macOS and Linux packages only for their platform', () => {
    const assets = createAssets('BevyBroom-macos.dmg', 'BevyBroom-linux.AppImage', 'BevyBroom-windows.exe');
    expect(selectStandaloneUpdateAsset(assets, 'macos')?.name).toBe('BevyBroom-macos.dmg');
    expect(selectStandaloneUpdateAsset(assets, 'linux')?.name).toBe('BevyBroom-linux.AppImage');
  });

  it('returns null when a release has no executable for the current platform', () => {
    const assets = createAssets('BevyBroom-source.zip', 'BevyBroom-sha256.txt');
    expect(selectStandaloneUpdateAsset(assets, 'windows')).toBeNull();
  });
});

/**
 * Creates independent release asset records for each selection scenario.
 *
 * @param names Asset names to materialize.
 * @returns Release asset records.
 */
function createAssets(...names: string[]): GitHubReleaseAsset[] {
  return names.map((name, index) => ({
    name,
    browserDownloadUrl: `https://github.com/Henry00IS/AiWorldEd/releases/download/test/${name}`,
    size: index + 1,
  }));
}
