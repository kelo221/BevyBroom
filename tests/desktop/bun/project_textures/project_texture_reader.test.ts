import { afterEach, describe, expect, it } from 'vitest';
import { ProjectTextureReader } from '@/desktop/bun/project_textures/project_texture_reader.js';
import {
  projectTextureTestAssetRootCreate,
  projectTextureTestDirectoriesRemove,
  projectTextureTestFileWrite,
} from './project_texture_test_files.js';

afterEach(() => projectTextureTestDirectoriesRemove());

/** Unit tests for reading one image of a project's texture directories. */
describe('ProjectTextureReader', () => {
  it('returns the bytes of an image inside a texture directory as base64', () => {
    const assetRoot = projectTextureTestAssetRootCreate();
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 255, 7]);
    projectTextureTestFileWrite(assetRoot, 'textures/walls/brick.png', bytes);
    const result = new ProjectTextureReader().read(assetRoot, ['textures'], 'textures\\walls/brick.png');
    if (!result.ok) {
      throw new Error(result.message);
    }
    expect(result.path).toBe('textures/walls/brick.png');
    expect(Array.from(Buffer.from(result.bytesBase64, 'base64'))).toEqual(Array.from(bytes));
  });

  it('refuses paths that escape the asset root, are absolute or are not images', () => {
    const assetRoot = projectTextureTestAssetRootCreate();
    const outsideRoot = projectTextureTestAssetRootCreate();
    projectTextureTestFileWrite(outsideRoot, 'secret.png', 'x');
    projectTextureTestFileWrite(assetRoot, 'textures/notes.txt', 'x');
    const reader = new ProjectTextureReader();
    const refusedPaths = [
      'textures/../../secret.png',
      `${outsideRoot}/secret.png`,
      '/secret.png',
      '',
      'textures/notes.txt',
    ];
    refusedPaths.forEach((path) => expect(reader.read(assetRoot, ['textures'], path).ok).toBe(false));
  });

  it('refuses images outside the texture directories', () => {
    const assetRoot = projectTextureTestAssetRootCreate();
    projectTextureTestFileWrite(assetRoot, 'models/skin.png', 'x');
    projectTextureTestFileWrite(assetRoot, 'texturesextra/look_alike.png', 'x');
    const reader = new ProjectTextureReader();
    expect(reader.read(assetRoot, ['textures'], 'models/skin.png').ok).toBe(false);
    expect(reader.read(assetRoot, ['textures'], 'texturesextra/look_alike.png').ok).toBe(false);
  });

  it('refuses files larger than the byte limit and missing files', () => {
    const assetRoot = projectTextureTestAssetRootCreate();
    const byteLimit = 4;
    projectTextureTestFileWrite(assetRoot, 'textures/small.png', 'x'.repeat(byteLimit));
    projectTextureTestFileWrite(assetRoot, 'textures/large.png', 'x'.repeat(byteLimit + 1));
    const reader = new ProjectTextureReader(byteLimit);
    expect(reader.read(assetRoot, ['textures'], 'textures/small.png').ok).toBe(true);
    const large = reader.read(assetRoot, ['textures'], 'textures/large.png');
    expect(large.ok ? '' : large.message).toContain(String(byteLimit));
    expect(reader.read(assetRoot, ['textures'], 'textures/missing.png').ok).toBe(false);
  });
});
