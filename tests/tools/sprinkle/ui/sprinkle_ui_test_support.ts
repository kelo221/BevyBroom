import { vi } from 'vitest';
import { getStateSprinkleTool } from '@/tools/sprinkle/state_sprinkle_tool.js';
import type { SprinkleDefinition, SprinkleDefinitionGrid } from '@/tools/sprinkle/definition/sprinkle_definition.js';
import {
  getStateSprinkleDefinitionLibrary,
  setStateSprinkleDefinitionLibraryForTests,
  StateSprinkleDefinitionLibrary,
  type SprinkleDefinitionLibraryLoadResult,
  type SprinkleDefinitionLibraryLoader,
} from '@/tools/sprinkle/definition/state_sprinkle_definition_library.js';
import type { DialogSprinkleServices } from '@/tools/sprinkle/ui/dialog_sprinkle.js';

/** Window services whose calls a test inspects. */
export interface SprinkleUiTestServices {
  /** Services handed to the window. */
  readonly services: DialogSprinkleServices;
  /** Status messages the window reported, in order. */
  readonly reports: string[];
  /** Spy of the return to the Select tool. */
  readonly toolSelectExit: ReturnType<typeof vi.fn>;
}

/** Loader whose load result and open answer a test sets; every call is a spy. */
export class SprinkleUiTestLoader implements SprinkleDefinitionLibraryLoader {
  /** Result the next load returns. */
  loadResult: SprinkleDefinitionLibraryLoadResult = { definitions: [], problems: [] };
  /** Answer the next source open returns. */
  sourceOpenAnswer: string | null = null;
  /** Spy of load. */
  readonly load = vi.fn(async () => this.loadResult);
  /** Spy of source opening. */
  readonly sourceOpen = vi.fn(async (_sourcePath: string) => this.sourceOpenAnswer);
}

/**
 * Builds a sprinkle definition with one case.
 *
 * @param name Type name.
 * @param grid Definition grid, or null when the file names none.
 * @returns Definition read from an imaginary file named after the type.
 */
export function sprinkleUiTestDefinitionCreate(name: string, grid: SprinkleDefinitionGrid | null): SprinkleDefinition {
  return {
    name,
    sourcePath: `sprinkle/${name.toLowerCase()}.txt`,
    grid,
    cases: [{ weight: 1, className: `test_game::${name}`, components: {} }],
  };
}

/**
 * Creates window services that record their calls.
 *
 * @param gridInterval Editor grid interval the services report, or null.
 * @returns Services and their recordings.
 */
export function sprinkleUiTestServicesCreate(gridInterval: number | null): SprinkleUiTestServices {
  const reports: string[] = [];
  const toolSelectExit = vi.fn(() => getStateSprinkleTool().toolActiveWrite(false));
  const services: DialogSprinkleServices = {
    gridIntervalRead: () => gridInterval,
    statusReport: (message) => reports.push(message),
    toolSelectExit,
  };
  return { services, reports, toolSelectExit };
}

/**
 * Installs a fresh sprinkle definition library with a recording loader.
 *
 * @returns Loader registered on the fresh library.
 */
export function sprinkleUiTestLibraryInstall(): SprinkleUiTestLoader {
  setStateSprinkleDefinitionLibraryForTests(new StateSprinkleDefinitionLibrary());
  const loader = new SprinkleUiTestLoader();
  getStateSprinkleDefinitionLibrary().loaderWrite(loader);
  return loader;
}

/** Restores the Sprinkle tool state, drops the library and clears the page. */
export function sprinkleUiTestReset(): void {
  getStateSprinkleTool().reset();
  setStateSprinkleDefinitionLibraryForTests(null);
  document.body.replaceChildren();
}
