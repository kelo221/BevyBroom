import { ProjectAssetFollower, type ProjectAssetFollowerWorkbench } from '@/project/assets/project_asset_follower.js';
import type {
  SprinkleDefinitionLibraryLoader,
  StateSprinkleDefinitionLibrary,
} from '@/tools/sprinkle/definition/state_sprinkle_definition_library.js';

/** The parts of the project workbench the follower watches. */
export type SprinkleDefinitionLibraryWorkbench = ProjectAssetFollowerWorkbench;

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
 */
export class SprinkleDefinitionLibraryProjectFollower extends ProjectAssetFollower {
  private readonly hosts: SprinkleDefinitionLibraryProjectFollowerHosts;

  /**
   * Creates the follower, registers the loader and loads the open project.
   *
   * @param hosts Collaborators.
   */
  constructor(hosts: SprinkleDefinitionLibraryProjectFollowerHosts) {
    super(hosts.workbench);
    this.hosts = hosts;
    hosts.library.loaderWrite(hosts.loader);
    this.followStart();
  }

  /**
   * Stops following the workbench, empties the library and unregisters the
   * loader.
   */
  override dispose(): void {
    super.dispose();
    this.hosts.library.loaderWrite(null);
  }

  /** Empties the project definitions of the library. */
  protected assetsClear(): void {
    this.hosts.library.contentsWrite({ definitions: [], problems: [] });
  }

  /**
   * Leaves the library without definitions and keeps the reason as its problem.
   *
   * @param reason Failure message.
   */
  protected loadFailureShow(reason: string): void {
    this.hosts.library.contentsWrite({ definitions: [], problems: [`Sprinkle definitions: ${reason}`] });
  }

  /**
   * Loads the definitions and hands them to the library unless a newer load
   * started meanwhile.
   *
   * @param generation Load generation the load belongs to.
   */
  protected async assetsLoad(generation: number): Promise<void> {
    const result = await this.hosts.loader.load();
    if (this.isCurrent(generation)) {
      this.hosts.library.contentsWrite(result);
    }
  }
}
