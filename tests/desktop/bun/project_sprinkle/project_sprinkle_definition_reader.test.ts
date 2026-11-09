import { afterEach, describe, expect, it } from 'vitest';
import { ProjectSprinkleDefinitionReader } from '@/desktop/bun/project_sprinkle/project_sprinkle_definition_reader.js';
import {
  projectTextureTestAssetRootCreate,
  projectTextureTestDirectoriesRemove,
  projectTextureTestFileWrite,
} from '../project_textures/project_texture_test_files.js';

afterEach(() => projectTextureTestDirectoriesRemove());

/** Unit tests for reading the sprinkle definition files of a project. */
describe('ProjectSprinkleDefinitionReader', () => {
  it('reads every .txt file below the sprinkle directories, recursively, sorted and asset-relative', () => {
    const assetRoot = projectTextureTestAssetRootCreate();
    const textByPath = new Map([
      ['sprinkle/plants.txt', 'Plants { }'],
      ['sprinkle/rocks/ROCKS.TXT', 'Rocks { }'],
      ['props/extra.txt', 'Extra { }'],
    ]);
    textByPath.forEach((text, path) => projectTextureTestFileWrite(assetRoot, path, text));
    projectTextureTestFileWrite(assetRoot, 'sprinkle/readme.md', 'not a definition');
    projectTextureTestFileWrite(assetRoot, 'outside/ignored.txt', 'outside the sprinkle directories');
    const result = new ProjectSprinkleDefinitionReader().readAll(assetRoot, ['sprinkle', 'props/', 'missing']);
    if (!result.ok) {
      throw new Error(result.message);
    }
    expect(result.files.map((file) => file.path)).toEqual([...textByPath.keys()].sort());
    result.files.forEach((file) => expect(file.text).toBe(textByPath.get(file.path)));
  });

  it('reads nothing without sprinkle directories', () => {
    const assetRoot = projectTextureTestAssetRootCreate();
    projectTextureTestFileWrite(assetRoot, 'sprinkle/a.txt', 'A { }');
    expect(new ProjectSprinkleDefinitionReader().readAll(assetRoot, [])).toEqual({ ok: true, files: [] });
  });

  it('refuses to read when a definition file is larger than the byte limit', () => {
    const assetRoot = projectTextureTestAssetRootCreate();
    const byteLimit = 8;
    projectTextureTestFileWrite(assetRoot, 'sprinkle/small.txt', 'x'.repeat(byteLimit));
    const reader = new ProjectSprinkleDefinitionReader(byteLimit);
    expect(reader.readAll(assetRoot, ['sprinkle']).ok).toBe(true);
    projectTextureTestFileWrite(assetRoot, 'sprinkle/large.txt', 'x'.repeat(byteLimit + 1));
    const refused = reader.readAll(assetRoot, ['sprinkle']);
    expect(refused.ok ? '' : refused.message).toContain('sprinkle/large.txt');
  });
});
