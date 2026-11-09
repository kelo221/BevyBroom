import { describe, expect, it } from 'vitest';
import { SprinkleDefinitionLibraryProjectFollower } from '@/tools/sprinkle/definition/loader/sprinkle_definition_library_project_follower.js';
import {
  StateSprinkleDefinitionLibrary,
  type SprinkleDefinitionLibraryLoader,
  type SprinkleDefinitionLibraryLoadResult,
} from '@/tools/sprinkle/definition/state_sprinkle_definition_library.js';
import type { SprinkleDefinition } from '@/tools/sprinkle/definition/sprinkle_definition.js';
import { workbenchRigCreate } from '../../../../project/workbench/project_workbench_rig.js';

/** Loader whose loads wait until the test releases them. */
class SprinkleDefinitionLoaderGated implements SprinkleDefinitionLibraryLoader {
  readonly pendingReleases: ((result: SprinkleDefinitionLibraryLoadResult) => void)[] = [];
  loadCount = 0;

  /** @inheritdoc */
  load(): Promise<SprinkleDefinitionLibraryLoadResult> {
    this.loadCount += 1;
    return new Promise((resolve) => this.pendingReleases.push(resolve));
  }

  /** @inheritdoc */
  async sourceOpen(): Promise<string | null> {
    return null;
  }

  /**
   * Answers the oldest waiting load.
   *
   * @param result Result the load returns.
   */
  release(result: SprinkleDefinitionLibraryLoadResult): void {
    this.pendingReleases.shift()?.(result);
  }
}

/**
 * Creates a definition of a name.
 *
 * @param name Definition name.
 * @returns Definition without cases.
 */
function definitionNamedCreate(name: string): SprinkleDefinition {
  return { name, sourcePath: `sprinkle/${name}.txt`, grid: null, cases: [] };
}

/**
 * Creates a load result holding one definition of a name.
 *
 * @param name Definition name.
 * @returns Load result.
 */
function resultNamedCreate(name: string): SprinkleDefinitionLibraryLoadResult {
  return { definitions: [definitionNamedCreate(name)], problems: [`problem of ${name}`] };
}

/**
 * Creates a workbench rig, a library, a gated loader and a follower over them.
 *
 * @returns The parts.
 */
function followerRigCreate() {
  const rig = workbenchRigCreate();
  const library = new StateSprinkleDefinitionLibrary();
  const loader = new SprinkleDefinitionLoaderGated();
  const follower = new SprinkleDefinitionLibraryProjectFollower({ workbench: rig.workbench, library, loader });
  return { rig, library, loader, follower };
}

/**
 * Unit tests for keeping the sprinkle definition library in step with the open
 * project.
 */
describe('SprinkleDefinitionLibraryProjectFollower', () => {
  it('registers its loader and loads nothing before a project opens', async () => {
    const { library, loader, follower } = followerRigCreate();
    expect(loader.loadCount).toBe(0);
    expect(await library.sourceOpen(definitionNamedCreate('any'))).toBeNull();
    follower.dispose();
    expect(await library.sourceOpen(definitionNamedCreate('any'))).not.toBeNull();
  });

  it('reloads the library every time a project is opened, even the same one again', async () => {
    const { rig, library, loader, follower } = followerRigCreate();
    const projectFile = '/games/first/broom.project.json';
    await rig.workbench.projectOpen(projectFile);
    loader.release(resultNamedCreate('first'));
    await follower.idle();
    expect(library.definitionsRead().map((definition) => definition.name)).toEqual(['first']);
    expect(library.problemsRead()).toEqual(['problem of first']);
    const loadsBefore = loader.loadCount;
    await rig.workbench.projectOpen(projectFile);
    expect(loader.loadCount).toBe(loadsBefore + 1);
    loader.release(resultNamedCreate('again'));
    await follower.idle();
    expect(library.definitionsRead().map((definition) => definition.name)).toEqual(['again']);
  });

  it('drops a load overtaken by a newer project', async () => {
    const { rig, library, loader, follower } = followerRigCreate();
    await rig.workbench.projectOpen('/games/old/broom.project.json');
    await rig.workbench.projectOpen('/games/new/broom.project.json');
    loader.release(resultNamedCreate('old'));
    loader.release(resultNamedCreate('new'));
    await follower.idle();
    expect(library.definitionsRead().map((definition) => definition.name)).toEqual(['new']);
  });

  it('reports a failing load as a problem without definitions', async () => {
    const rig = workbenchRigCreate();
    const library = new StateSprinkleDefinitionLibrary();
    const failure = 'disk unplugged';
    const loader: SprinkleDefinitionLibraryLoader = {
      load: async () => Promise.reject(new Error(failure)),
      sourceOpen: async () => null,
    };
    const follower = new SprinkleDefinitionLibraryProjectFollower({ workbench: rig.workbench, library, loader });
    await rig.workbench.projectOpen('/games/failing/broom.project.json');
    await follower.idle();
    expect(library.definitionsRead()).toEqual([]);
    expect(library.problemsRead().join('\n')).toContain(failure);
  });
});
