import { afterEach, describe, expect, it } from 'vitest';
import { ProjectModelReader } from '@/desktop/bun/project_models/project_model_reader.js';
import {
  projectTextureTestAssetRootCreate,
  projectTextureTestDirectoriesRemove,
  projectTextureTestFileWrite,
} from '../project_textures/project_texture_test_files.js';

afterEach(() => projectTextureTestDirectoriesRemove());

/** Unit tests for reading one binary glTF model below a project's asset root. */
describe('ProjectModelReader', () => {
  it('returns the bytes of a .glb file anywhere below the asset root as base64', () => {
    const assetRoot = projectTextureTestAssetRootCreate();
    const bytes = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 2, 0, 0, 0]);
    projectTextureTestFileWrite(assetRoot, 'assets/Models/Props/Crate/Crate.glb', bytes);
    const result = new ProjectModelReader().read(assetRoot, 'assets\\Models/Props/Crate/Crate.glb');
    if (!result.ok) {
      throw new Error(result.message);
    }
    expect(result.path).toBe('assets/Models/Props/Crate/Crate.glb');
    expect(Array.from(Buffer.from(result.bytesBase64, 'base64'))).toEqual(Array.from(bytes));
  });

  it('refuses paths that escape the asset root, are absolute or are not .glb files', () => {
    const assetRoot = projectTextureTestAssetRootCreate();
    const outsideRoot = projectTextureTestAssetRootCreate();
    projectTextureTestFileWrite(outsideRoot, 'secret.glb', 'x');
    projectTextureTestFileWrite(assetRoot, 'models/notes.txt', 'x');
    projectTextureTestFileWrite(assetRoot, 'models/scene.gltf', 'x');
    const reader = new ProjectModelReader();
    const refusedPaths = [
      'models/../../secret.glb',
      `${outsideRoot}/secret.glb`,
      '/secret.glb',
      '',
      'models/notes.txt',
      'models/scene.gltf',
    ];
    refusedPaths.forEach((path) => expect(reader.read(assetRoot, path).ok).toBe(false));
  });

  it('refuses files larger than the byte limit and missing files', () => {
    const assetRoot = projectTextureTestAssetRootCreate();
    const byteLimit = 4;
    projectTextureTestFileWrite(assetRoot, 'models/small.glb', 'x'.repeat(byteLimit));
    projectTextureTestFileWrite(assetRoot, 'models/large.glb', 'x'.repeat(byteLimit + 1));
    const reader = new ProjectModelReader(byteLimit);
    expect(reader.read(assetRoot, 'models/small.glb').ok).toBe(true);
    const large = reader.read(assetRoot, 'models/large.glb');
    expect(large.ok ? '' : large.message).toContain(String(byteLimit));
    expect(reader.read(assetRoot, 'models/missing.glb').ok).toBe(false);
  });
});
