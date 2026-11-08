import type { SprinkleDefinition } from './sprinkle_definition.js';
import { SprinkleDefinitionBuiltin } from './builtin/sprinkle_definition_builtin.js';

/** Listener notified when the loaded sprinkle definitions change. */
export type StateSprinkleDefinitionLibraryListener = () => void;

/** Loads the sprinkle definitions of the open project. */
export interface SprinkleDefinitionLibraryLoader {
  /**
   * Reads and parses every definition file.
   *
   * @returns Definitions and the problems found while reading them.
   */
  load(): Promise<SprinkleDefinitionLibraryLoadResult>;
  /**
   * Opens a definition file in the system's text editor.
   *
   * @param sourcePath File path relative to the project asset root.
   * @returns Null when the file opened, otherwise why it did not.
   */
  sourceOpen(sourcePath: string): Promise<string | null>;
}

/** Definitions and problems produced by one library load. */
export interface SprinkleDefinitionLibraryLoadResult {
  /** Definitions in Type list order. */
  readonly definitions: readonly SprinkleDefinition[];
  /** Human-readable problems such as parse errors, one per entry. */
  readonly problems: readonly string[];
}

/**
 * Message returned when Open Source is asked for a definition that has no
 * project file.
 */
const SPRINKLE_DEFINITION_BUILTIN_SOURCE_MESSAGE =
  'Built-in sample types have no source file; copy them into a sprinkle_directories folder of the project to edit them.';

/**
 * Holds the sprinkle definitions of the open project, followed by the built-in
 * definitions whose names the project does not use, and refreshes them through
 * a registered loader.
 */
export class StateSprinkleDefinitionLibrary {
  private readonly builtinDefinitions: readonly SprinkleDefinition[];
  private definitions: readonly SprinkleDefinition[];
  private problems: readonly string[] = [];
  private loader: SprinkleDefinitionLibraryLoader | null = null;
  private readonly listeners = new Set<StateSprinkleDefinitionLibraryListener>();

  /**
   * Creates the library holding only the built-in definitions.
   *
   * @param builtinDefinitions Definitions that ship with the editor, always
   *   listed after the project's definitions.
   */
  constructor(builtinDefinitions: readonly SprinkleDefinition[] = []) {
    this.builtinDefinitions = builtinDefinitions;
    this.definitions = builtinDefinitions;
  }

  /**
   * Registers the loader used by refresh and source opening.
   *
   * @param loader Loader, or null to clear.
   */
  loaderWrite(loader: SprinkleDefinitionLibraryLoader | null): void {
    this.loader = loader;
  }

  /**
   * Returns the loaded definitions in Type list order.
   *
   * @returns Definitions.
   */
  definitionsRead(): readonly SprinkleDefinition[] {
    return this.definitions;
  }

  /**
   * Returns the definition with a name.
   *
   * @param name Definition name, or null.
   * @returns The definition, or null when none has the name.
   */
  definitionFind(name: string | null): SprinkleDefinition | null {
    return this.definitions.find((definition) => definition.name === name) ?? null;
  }

  /**
   * Returns the problems found by the last load.
   *
   * @returns Problem descriptions.
   */
  problemsRead(): readonly string[] {
    return this.problems;
  }

  /**
   * Reloads the definitions through the loader and notifies listeners.
   *
   * @returns Resolves once the definitions are replaced; without a loader they
   *   stay as they are.
   */
  async refresh(): Promise<void> {
    if (!this.loader) {
      return;
    }
    const result = await this.loader.load();
    this.contentsWrite(result);
  }

  /**
   * Replaces the project's definitions and problems, keeps the built-in
   * definitions whose names the project does not use after them, and notifies
   * listeners.
   *
   * @param result Project definitions and problems.
   */
  contentsWrite(result: SprinkleDefinitionLibraryLoadResult): void {
    this.definitions = [...result.definitions, ...this.builtinDefinitionsUnshadowed(result.definitions)];
    this.problems = result.problems;
    this.listenersNotify();
  }

  /**
   * Returns the built-in definitions whose names none of the given definitions
   * use.
   *
   * @param projectDefinitions Definitions loaded from the project.
   * @returns Built-in definitions without a name clash.
   */
  private builtinDefinitionsUnshadowed(projectDefinitions: readonly SprinkleDefinition[]): SprinkleDefinition[] {
    const projectNames = new Set(projectDefinitions.map((definition) => definition.name));
    return this.builtinDefinitions.filter((definition) => !projectNames.has(definition.name));
  }

  /**
   * Opens a definition's file in the system's text editor.
   *
   * @param definition Definition whose file opens.
   * @returns Null when the file opened, otherwise why it did not.
   */
  async sourceOpen(definition: SprinkleDefinition): Promise<string | null> {
    if (this.builtinDefinitions.includes(definition)) {
      return SPRINKLE_DEFINITION_BUILTIN_SOURCE_MESSAGE;
    }
    if (!this.loader) {
      return 'Sprinkle definition files can only be opened in the desktop app.';
    }
    return this.loader.sourceOpen(definition.sourcePath);
  }

  /**
   * Subscribes to definition changes.
   *
   * @param listener Change callback.
   * @returns Unsubscribe function.
   */
  changeListenerAdd(listener: StateSprinkleDefinitionLibraryListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Notifies all registered listeners. */
  private listenersNotify(): void {
    this.listeners.forEach((listener) => listener());
  }
}

let sharedSprinkleDefinitionLibrary: StateSprinkleDefinitionLibrary | null = null;

/**
 * Returns the shared sprinkle definition library singleton, created with the
 * built-in sample definitions.
 *
 * @returns Shared library.
 */
export function getStateSprinkleDefinitionLibrary(): StateSprinkleDefinitionLibrary {
  if (!sharedSprinkleDefinitionLibrary) {
    sharedSprinkleDefinitionLibrary = new StateSprinkleDefinitionLibrary(SprinkleDefinitionBuiltin.definitionsBuild());
  }
  return sharedSprinkleDefinitionLibrary;
}

/**
 * Replaces the shared library, for tests.
 *
 * @param library Library to share, or null to create a fresh one on next use.
 */
export function setStateSprinkleDefinitionLibraryForTests(library: StateSprinkleDefinitionLibrary | null): void {
  sharedSprinkleDefinitionLibrary = library;
}
