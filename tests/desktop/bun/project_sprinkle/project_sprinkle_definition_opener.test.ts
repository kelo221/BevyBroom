import { realpathSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { ProjectSprinkleDefinitionOpener } from '@/desktop/bun/project_sprinkle/project_sprinkle_definition_opener.js';
import {
  projectTextureTestAssetRootCreate,
  projectTextureTestDirectoriesRemove,
  projectTextureTestFileWrite,
} from '../project_textures/project_texture_test_files.js';

afterEach(() => projectTextureTestDirectoriesRemove());

/** Sprinkle directory of the temporary projects, relative to the asset root. */
const OPENER_TEST_SPRINKLE_DIRECTORY = 'sprinkle';

/**
 * Creates an opener that records the paths it was asked to open.
 *
 * @returns Opener and the recorded paths.
 */
function openerRecordingCreate(): { opener: ProjectSprinkleDefinitionOpener; openedPaths: string[] } {
  const openedPaths: string[] = [];
  const opener = new ProjectSprinkleDefinitionOpener(async (absolutePath) => {
    openedPaths.push(absolutePath);
  });
  return { opener, openedPaths };
}

/** Unit tests for opening sprinkle definition files in the system's text editor. */
describe('ProjectSprinkleDefinitionOpener', () => {
  it('opens the real path of a definition file inside a sprinkle directory', async () => {
    const assetRoot = projectTextureTestAssetRootCreate();
    const definitionPath = `${OPENER_TEST_SPRINKLE_DIRECTORY}/plants/agave.txt`;
    projectTextureTestFileWrite(assetRoot, definitionPath, 'Agave { }');
    const { opener, openedPaths } = openerRecordingCreate();
    const result = await opener.open(assetRoot, [OPENER_TEST_SPRINKLE_DIRECTORY], definitionPath.replace(/\//g, '\\'));
    expect(result).toEqual({ ok: true });
    expect(openedPaths).toEqual([realpathSync(`${assetRoot}/${definitionPath}`)]);
  });

  it('refuses paths that escape, are absolute, are not .txt or lie outside the sprinkle directories', async () => {
    const assetRoot = projectTextureTestAssetRootCreate();
    const outsideRoot = projectTextureTestAssetRootCreate();
    projectTextureTestFileWrite(outsideRoot, 'secret.txt', 'x');
    projectTextureTestFileWrite(assetRoot, `${OPENER_TEST_SPRINKLE_DIRECTORY}/script.bat`, 'x');
    projectTextureTestFileWrite(assetRoot, 'other/notes.txt', 'x');
    projectTextureTestFileWrite(assetRoot, `${OPENER_TEST_SPRINKLE_DIRECTORY}extra/look_alike.txt`, 'x');
    const refusedPaths = [
      `${OPENER_TEST_SPRINKLE_DIRECTORY}/../../secret.txt`,
      `${outsideRoot}/secret.txt`,
      '',
      `${OPENER_TEST_SPRINKLE_DIRECTORY}/script.bat`,
      'other/notes.txt',
      `${OPENER_TEST_SPRINKLE_DIRECTORY}extra/look_alike.txt`,
      `${OPENER_TEST_SPRINKLE_DIRECTORY}/missing.txt`,
    ];
    const { opener, openedPaths } = openerRecordingCreate();
    for (const refusedPath of refusedPaths) {
      const result = await opener.open(assetRoot, [OPENER_TEST_SPRINKLE_DIRECTORY], refusedPath);
      expect(result.ok, refusedPath).toBe(false);
    }
    expect(openedPaths).toEqual([]);
  });

  it('returns why the system opener failed', async () => {
    const assetRoot = projectTextureTestAssetRootCreate();
    const definitionPath = `${OPENER_TEST_SPRINKLE_DIRECTORY}/a.txt`;
    projectTextureTestFileWrite(assetRoot, definitionPath, 'A { }');
    const failure = 'no text editor installed';
    const opener = new ProjectSprinkleDefinitionOpener(async () => Promise.reject(new Error(failure)));
    const result = await opener.open(assetRoot, [OPENER_TEST_SPRINKLE_DIRECTORY], definitionPath);
    expect(result.ok ? '' : result.message).toContain(failure);
  });
});
