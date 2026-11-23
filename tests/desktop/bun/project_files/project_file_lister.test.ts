import { afterEach, describe, expect, it } from 'vitest';
import { symlinkSync } from 'node:fs';
import { ProjectFileLister } from '@/desktop/bun/project_files/project_file_lister.js';
import { ProjectFilePaths } from '@/desktop/bun/project_files/project_file_paths.js';
import {
  projectTextureTestAssetRootCreate,
  projectTextureTestDirectoriesRemove,
  projectTextureTestFileWrite,
} from '../project_textures/project_texture_test_files.js';

afterEach(() => projectTextureTestDirectoriesRemove());

/** Unit tests for listing the files of chosen kinds below project directories. */
describe('ProjectFileLister', () => {
  it('lists only the files the name filter accepts, recursively and sorted', () => {
    const assetRoot = projectTextureTestAssetRootCreate();
    const acceptedPaths = ['data/b.keep', 'data/deep/a.keep'];
    acceptedPaths.forEach((path) => projectTextureTestFileWrite(assetRoot, path, 'x'));
    projectTextureTestFileWrite(assetRoot, 'data/c.drop', 'x');
    const listed = ProjectFileLister.list(assetRoot, ['data'], (fileName) => fileName.endsWith('.keep'));
    expect(listed).toEqual([...acceptedPaths].sort());
  });
});

/** Unit tests for the relative path helpers of project files. */
describe('ProjectFilePaths', () => {
  it('finds a path inside any of several directories but not in look-alike siblings', () => {
    const directories = ['sprinkle\\', './props/foliage'];
    expect(ProjectFilePaths.isInsideAnyDirectory('props/foliage/grass.txt', directories)).toBe(true);
    expect(ProjectFilePaths.isInsideAnyDirectory('sprinkle/a.txt', directories)).toBe(true);
    expect(ProjectFilePaths.isInsideAnyDirectory('sprinkleextra/a.txt', directories)).toBe(false);
    expect(ProjectFilePaths.isInsideAnyDirectory('anything.txt', ['.'])).toBe(true);
    expect(ProjectFilePaths.isInsideAnyDirectory('anything.txt', [])).toBe(false);
  });
});

/**
 * Files stored as links, such as git-annex links into the git directory, are
 * listed like plain files; broken links and links to directories are not.
 */
describe('ProjectFileLister links', () => {
  it('lists links to files and skips broken links and links to directories', () => {
    const projectDirectory = projectTextureTestAssetRootCreate();
    const annexObject = '.git/annex/objects/SHA256E-s3--abc.png/SHA256E-s3--abc.png';
    projectTextureTestFileWrite(projectDirectory, annexObject, 'png');
    projectTextureTestFileWrite(projectDirectory, 'assets/textures/store/Plain.png', 'png');
    projectTextureTestFileWrite(projectDirectory, 'assets/elsewhere/Hidden.png', 'png');
    const storeDirectory = `${projectDirectory}/assets/textures/store`;
    symlinkSync(`../../../${annexObject}`, `${storeDirectory}/Annexed.png`);
    symlinkSync('../../../.git/annex/objects/missing.png', `${storeDirectory}/Broken.png`);
    symlinkSync('../../elsewhere', `${storeDirectory}/linked_directory`);
    const listed = ProjectFileLister.list(`${projectDirectory}/assets`, ['textures/store'], (fileName) =>
      fileName.endsWith('.png'),
    );
    expect(listed).toEqual(['textures/store/Annexed.png', 'textures/store/Plain.png']);
  });
});
