import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TextureProjectSourceLoader,
  type TextureProjectSourceSink,
} from '@/texture/project/texture_project_source_loader.js';
import type { TextureBrowserEntry } from '@/texture/library/texture_browser_entry.js';
import { TEXTURE_LIBRARY_SOURCE_PROJECT_TEXTURES } from '@/texture/library/texture_library_source.js';
import { bytesToBase64 } from '@/utils/utils_base64.js';
import { mockObjectUrlApis } from '../library/utils_object_url_test.js';
import { workbenchRigCreate } from '../../project/workbench/project_workbench_rig.js';

/** One call the recording sink received. */
interface SinkCall {
  kind: 'apply' | 'clear';
  sourceName: string;
  entries: TextureBrowserEntry[];
}

/** Sink that records every call. */
class TextureProjectSourceSinkRecording implements TextureProjectSourceSink {
  readonly calls: SinkCall[] = [];

  /**
   * Records an apply call.
   *
   * @param sourceName Name of the texture library source.
   * @param entries Entries of the source.
   */
  applyEntries(sourceName: string, entries: TextureBrowserEntry[]): void {
    this.calls.push({ kind: 'apply', sourceName, entries });
  }

  /**
   * Records a clear call.
   *
   * @param sourceName Name of the texture library source.
   */
  clearSource(sourceName: string): void {
    this.calls.push({ kind: 'clear', sourceName, entries: [] });
  }

  /**
   * Returns the ids of every applied batch, oldest first.
   *
   * @returns Entry ids per apply call.
   */
  appliedIdsRead(): string[][] {
    return this.calls.filter((call) => call.kind === 'apply').map((call) => call.entries.map((entry) => entry.id));
  }
}

/**
 * Builds a workbench rig with fake project images, a recording sink and a
 * loader following the workbench.
 *
 * @returns Rig parts.
 */
function loaderRigCreate() {
  const rig = workbenchRigCreate();
  const sink = new TextureProjectSourceSinkRecording();
  const statusMessages: string[] = [];
  const loader = new TextureProjectSourceLoader({
    workbench: rig.workbench,
    control: rig.control,
    sink,
    statusReport: (message) => statusMessages.push(message),
  });
  return { ...rig, sink, statusMessages, loader };
}

/**
 * Stores fake images for a project in the fake control.
 *
 * @param rig Loader rig.
 * @param projectFile Project file path.
 * @param texturePaths Asset-relative image paths; each file holds its own path
 *   as bytes.
 */
function projectTexturesStore(
  rig: ReturnType<typeof loaderRigCreate>,
  projectFile: string,
  texturePaths: string[],
): void {
  const files = new Map(texturePaths.map((path) => [path, bytesToBase64(new TextEncoder().encode(path))]));
  rig.control.projectTextureFiles.set(projectFile, files);
}

/** Unit tests for the loader that fills the Project textures source. */
describe('TextureProjectSourceLoader', () => {
  let rig: ReturnType<typeof loaderRigCreate>;

  beforeEach(() => {
    mockObjectUrlApis('blob:project');
    rig = loaderRigCreate();
  });

  afterEach(() => {
    rig.loader.dispose();
    rig.workbench.dispose();
    vi.restoreAllMocks();
  });

  it('fills the project source with entries whose ids are asset-relative paths', async () => {
    const projectFile = '/games/castle/broom.project.json';
    const texturePaths = ['textures/walls/brick.png', 'textures/floor.jpg'];
    projectTexturesStore(rig, projectFile, texturePaths);
    await rig.workbench.projectOpen(projectFile);
    await rig.loader.idle();
    const applied = rig.sink.calls.filter((call) => call.kind === 'apply');
    expect(applied).toHaveLength(1);
    expect(applied[0]?.sourceName).toBe(TEXTURE_LIBRARY_SOURCE_PROJECT_TEXTURES);
    const entries = applied[0]?.entries ?? [];
    expect(entries.map((entry) => entry.id).sort()).toEqual([...texturePaths].sort());
    expect(entries.every((entry) => entry.sourceName === TEXTURE_LIBRARY_SOURCE_PROJECT_TEXTURES)).toBe(true);
    const floor = entries.find((entry) => entry.id === 'textures/floor.jpg');
    expect(floor?.mimeType).toBe('image/jpeg');
    expect(await floor?.sourceFile.text()).toBe('textures/floor.jpg');
  });

  it('drops the results of a load overtaken by another project and revokes them', async () => {
    const firstProject = '/games/first/broom.project.json';
    const secondProject = '/games/second/broom.project.json';
    projectTexturesStore(rig, firstProject, ['textures/first.png']);
    projectTexturesStore(rig, secondProject, ['textures/second.png']);
    let gateRelease: () => void = () => undefined;
    rig.control.projectTextureReadGate = new Promise((resolve) => (gateRelease = resolve));
    await rig.workbench.projectOpen(firstProject);
    await rig.workbench.projectOpen(secondProject);
    gateRelease();
    await rig.loader.idle();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(rig.sink.appliedIdsRead()).toEqual([['textures/second.png']]);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(expect.stringContaining('first.png'));
  });

  it('clears the source when a project opens again and loads its current images', async () => {
    const projectFile = '/games/castle/broom.project.json';
    projectTexturesStore(rig, projectFile, ['textures/old.png']);
    await rig.workbench.projectOpen(projectFile);
    await rig.loader.idle();
    projectTexturesStore(rig, projectFile, ['textures/new.png']);
    await rig.workbench.projectOpen(projectFile);
    await rig.loader.idle();
    expect(rig.sink.appliedIdsRead()).toEqual([['textures/old.png'], ['textures/new.png']]);
    const lastClearIndex = rig.sink.calls.map((call) => call.kind).lastIndexOf('clear');
    expect(lastClearIndex).toBe(rig.sink.calls.length - 2);
  });

  it('does not reload while only the game status changes', async () => {
    const projectFile = '/games/castle/broom.project.json';
    projectTexturesStore(rig, projectFile, ['textures/a.png']);
    await rig.workbench.projectOpen(projectFile);
    await rig.loader.idle();
    await rig.workbench.statusRefresh();
    await rig.loader.idle();
    expect(rig.sink.appliedIdsRead()).toHaveLength(1);
  });

  it('reports a failed listing and applies nothing', async () => {
    const projectFile = '/games/castle/broom.project.json';
    rig.control.projectTextureList = async () => ({ ok: false, message: 'listing exploded' });
    await rig.workbench.projectOpen(projectFile);
    await rig.loader.idle();
    expect(rig.sink.appliedIdsRead()).toEqual([]);
    expect(rig.statusMessages.at(-1)).toContain('listing exploded');
  });

  it('clears the project source when disposed', () => {
    rig.loader.dispose();
    expect(rig.sink.calls.at(-1)).toEqual({
      kind: 'clear',
      sourceName: TEXTURE_LIBRARY_SOURCE_PROJECT_TEXTURES,
      entries: [],
    });
  });
});
