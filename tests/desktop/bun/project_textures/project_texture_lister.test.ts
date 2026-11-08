import { afterEach, describe, expect, it } from 'vitest';
import { ProjectTextureLister } from '@/desktop/bun/project_textures/project_texture_lister.js';
import {
  projectTextureTestAssetRootCreate,
  projectTextureTestDirectoriesRemove,
  projectTextureTestFileWrite,
} from './project_texture_test_files.js';

afterEach(() => projectTextureTestDirectoriesRemove());

/** Unit tests for listing the images of a project's texture directories. */
describe('ProjectTextureLister', () => {
  it('lists images below every texture directory, recursively, sorted and asset-relative', () => {
    const assetRoot = projectTextureTestAssetRootCreate();
    const imagePaths = ['textures/walls/stone/granite.PNG', 'textures/floor.jpg', 'decals/moss.webp'];
    imagePaths.forEach((path) => projectTextureTestFileWrite(assetRoot, path, 'x'));
    projectTextureTestFileWrite(assetRoot, 'textures/readme.txt', 'not an image');
    projectTextureTestFileWrite(assetRoot, 'models/ignored.png', 'outside the texture directories');
    const listed = ProjectTextureLister.list(assetRoot, ['textures', 'decals/']);
    expect(listed).toEqual([...imagePaths].sort());
  });

  it('skips missing directories and lists overlapping directories once', () => {
    const assetRoot = projectTextureTestAssetRootCreate();
    projectTextureTestFileWrite(assetRoot, 'textures/walls/brick.png', 'x');
    const listed = ProjectTextureLister.list(assetRoot, ['missing', 'textures', 'textures/walls', './textures']);
    expect(listed).toEqual(['textures/walls/brick.png']);
  });

  it('lists the whole asset root for "."', () => {
    const assetRoot = projectTextureTestAssetRootCreate();
    projectTextureTestFileWrite(assetRoot, 'top.png', 'x');
    projectTextureTestFileWrite(assetRoot, 'deep/inner.gif', 'x');
    expect(ProjectTextureLister.list(assetRoot, ['.'])).toEqual(['deep/inner.gif', 'top.png']);
  });

  it('lists nothing without texture directories', () => {
    const assetRoot = projectTextureTestAssetRootCreate();
    projectTextureTestFileWrite(assetRoot, 'textures/a.png', 'x');
    expect(ProjectTextureLister.list(assetRoot, [])).toEqual([]);
  });
});
