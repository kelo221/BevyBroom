import {
  projectWorkbenchOpenKeyRead,
  type ProjectWorkbenchOpenKeySource,
} from '@/project/workbench/project_workbench_open_key.js';
import type {
  SprinkleDefinitionLibraryLoader,
  StateSprinkleDefinitionLibrary,
} from '@/tools/sprinkle/definition/state_sprinkle_definition_library.js';

/** The parts of the project workbench the follower watches. */
export interface SprinkleDefinitionLibraryWorkbench extends ProjectWorkbenchOpenKeySource {
  /**
   * Registers a callback run whenever the project status changes.
   *
   * @param listener Change callback.
   * @returns Function that removes the callback.
   */
  changeListenerAdd(listener: () => void): () => void;
}

/** Collaborators of the sprinkle definition library follower. */
export interface SprinkleDefinitionLibraryProjectFollowerHosts {
  /** Workbench whose open project is followed. */
  workbench: SprinkleDefinitionLibraryWorkbench;
  /** Library that receives the definitions. */
  library: StateSprinkleDefinitionLibrary;
  /** Loader registered with the library and used for every reload. */
  loader: SprinkleDefinitionLibraryLoader;
}

/**
 * Registers a loader with the sprinkle definition library and reloads the
 * library whenever a project is opened; empties it when the project goes away.
 * Results of a load overtaken by a newer project are dropped.
 */
export class SprinkleDefinitionLibraryProjectFollower {
  private readonly hosts: SprinkleDefinitionLibraryProjectFollowerHosts;
  private readonly listenerRemove: () => void;
  private shownProjectKey: string | null = null;
  private loadGeneration = 0;
  private pendingLoad: Promise<void> = Promise.resolve();

  /**
   * Creates the follower, registers the loader and loads the open project.
   *
   * @param hosts Collaborators.
   */
  constructor(hosts: SprinkleDefinitionLibraryProjectFollowerHosts) {
    this.hosts = hosts;
    hosts.library.loaderWrite(hosts.loader);
    this.listenerRemove = hosts.workbench.changeListenerAdd(() => this.projectChangeHandle());
    this.projectChangeHandle();
  }

  /**
   * Waits for the newest load to finish.
   *
   * @returns Promise that settles once the newest load is done.
   */
  idle(): Promise<void> {
    return this.pendingLoad;
  }

  /** Stops following the workbench and unregisters the loader. */
  dispose(): void {
    this.listenerRemove();
    this.loadGeneration += 1;
    this.hosts.library.loaderWrite(null);
  }

  /**
   * Reloads or empties the library when the open project differs from the shown
   * one.
   */
  private projectChangeHandle(): void {
    const projectKey = projectWorkbenchOpenKeyRead(this.hosts.workbench);
    if (projectKey === this.shownProjectKey) {
      return;
    }
    this.shownProjectKey = projectKey;
    this.loadGeneration += 1;
    if (projectKey === null) {
      this.hosts.library.contentsWrite({ definitions: [], problems: [] });
      return;
    }
    this.pendingLoad = this.loadRun(this.loadGeneration);
  }

  /**
   * Loads the definitions and hands them to the library unless a newer load
   * started meanwhile; a failing load leaves no definitions and its reason as
   * the problem.
   *
   * @param generation Load generation the load belongs to.
   */
  private async loadRun(generation: number): Promise<void> {
    try {
      const result = await this.hosts.loader.load();
      if (generation === this.loadGeneration) {
        this.hosts.library.contentsWrite(result);
      }
    } catch (error) {
      if (generation === this.loadGeneration) {
        const reason = error instanceof Error ? error.message : String(error);
        this.hosts.library.contentsWrite({ definitions: [], problems: [`Sprinkle definitions: ${reason}`] });
      }
    }
  }
}
