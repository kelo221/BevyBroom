import { describe, expect, it } from 'vitest';
import type { SprinkleDefinition } from '@/tools/sprinkle/definition/sprinkle_definition.js';
import {
  StateSprinkleDefinitionLibrary,
  getStateSprinkleDefinitionLibrary,
  setStateSprinkleDefinitionLibraryForTests,
  type SprinkleDefinitionLibraryLoader,
} from '@/tools/sprinkle/definition/state_sprinkle_definition_library.js';
import { SprinkleDefinitionBuiltin } from '@/tools/sprinkle/definition/builtin/sprinkle_definition_builtin.js';

/**
 * Builds a one-case definition.
 *
 * @param name Definition name.
 * @param sourcePath Definition file path.
 * @returns Definition.
 */
function libraryTestDefinitionCreate(name: string, sourcePath: string): SprinkleDefinition {
  return { name, sourcePath, grid: null, cases: [{ weight: 1, className: 'lights.point', components: {} }] };
}

/**
 * Builds a loader that records which source paths it was asked to open.
 *
 * @param openedPaths Receives every opened path.
 * @returns Loader returning no definitions.
 */
function libraryTestLoaderCreate(openedPaths: string[]): SprinkleDefinitionLibraryLoader {
  return {
    load: () => Promise.resolve({ definitions: [], problems: [] }),
    sourceOpen: (sourcePath) => {
      openedPaths.push(sourcePath);
      return Promise.resolve(null);
    },
  };
}

/**
 * Sprinkle definition library: project definitions come first, built-in
 * definitions follow unless a project definition uses their name, and only
 * project definitions open through the loader.
 */
describe('StateSprinkleDefinitionLibrary', () => {
  const builtin = libraryTestDefinitionCreate('Built-in sample', 'builtin:sample.txt');

  it('starts with only the built-in definitions', () => {
    expect(new StateSprinkleDefinitionLibrary([builtin]).definitionsRead()).toEqual([builtin]);
  });

  it('lists project definitions before the built-in ones', () => {
    const library = new StateSprinkleDefinitionLibrary([builtin]);
    const project = libraryTestDefinitionCreate('Project type', 'sprinkle/project.txt');
    library.contentsWrite({ definitions: [project], problems: [] });
    expect(library.definitionsRead()).toEqual([project, builtin]);
  });

  it('drops a built-in definition whose name a project definition uses', () => {
    const library = new StateSprinkleDefinitionLibrary([builtin]);
    const shadowing = libraryTestDefinitionCreate(builtin.name, 'sprinkle/override.txt');
    library.contentsWrite({ definitions: [shadowing], problems: [] });
    expect(library.definitionsRead()).toEqual([shadowing]);
    expect(library.definitionFind(builtin.name)).toBe(shadowing);
  });

  it('keeps the built-in definitions when the project has none', () => {
    const library = new StateSprinkleDefinitionLibrary([builtin]);
    library.contentsWrite({ definitions: [], problems: ['no project'] });
    expect(library.definitionsRead()).toEqual([builtin]);
    expect(library.problemsRead()).toEqual(['no project']);
  });

  it('explains instead of opening a built-in definition and opens project definitions through the loader', async () => {
    const openedPaths: string[] = [];
    const library = new StateSprinkleDefinitionLibrary([builtin]);
    const project = libraryTestDefinitionCreate('Project type', 'sprinkle/project.txt');
    library.loaderWrite(libraryTestLoaderCreate(openedPaths));
    library.contentsWrite({ definitions: [project], problems: [] });
    expect(await library.sourceOpen(builtin)).toMatch(/built-in/i);
    expect(await library.sourceOpen(project)).toBeNull();
    expect(openedPaths).toEqual([project.sourcePath]);
  });

  it('creates the shared library with the editor built-in definitions', () => {
    setStateSprinkleDefinitionLibraryForTests(null);
    const names = getStateSprinkleDefinitionLibrary()
      .definitionsRead()
      .map((definition) => definition.name);
    expect(names).toEqual(SprinkleDefinitionBuiltin.definitionsBuild().map((definition) => definition.name));
    setStateSprinkleDefinitionLibraryForTests(null);
  });
});
