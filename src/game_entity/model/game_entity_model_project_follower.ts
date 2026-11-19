import type { GameProcessControl } from '@/project/control/game_process_control.js';
import { ProjectAssetFollower, type ProjectAssetFollowerWorkbench } from '@/project/assets/project_asset_follower.js';
import { GameEntityModelLibrary } from '@/game_entity/model/game_entity_model_library.js';

/**
 * Collaborators of the follower that points the model library at the open
 * project.
 */
export interface GameEntityModelProjectFollowerHosts {
  /** Workbench whose open project is followed. */
  workbench: ProjectAssetFollowerWorkbench;
  /** Reads the project's model files. */
  control: GameProcessControl;
  /** Shows a short message about a model that could not be loaded. */
  statusReport: (message: string) => void;
  /** Library to point at the project; the shared one when left out. */
  library?: GameEntityModelLibrary;
  /**
   * Target whose focus reads the models again, or null to read them once per
   * opening.
   */
  focusTarget?: EventTarget | null;
}

/**
 * Points the game entity model library at the open project: every time a
 * project is opened the library forgets its models and reads new ones from that
 * project, and when the project goes away it reads none. Gaining focus reads
 * them again, so models exported by other programs show up.
 */
export class GameEntityModelProjectFollower extends ProjectAssetFollower {
  private readonly hosts: GameEntityModelProjectFollowerHosts;
  private readonly library: GameEntityModelLibrary;

  /**
   * Creates the follower and starts following the workbench.
   *
   * @param hosts Collaborators.
   */
  constructor(hosts: GameEntityModelProjectFollowerHosts) {
    super(hosts.workbench);
    this.hosts = hosts;
    this.library = hosts.library ?? GameEntityModelLibrary.shared;
    this.followStart();
    if (hosts.focusTarget) {
      this.focusReloadFollow(hosts.focusTarget);
    }
  }

  /** Makes the library forget its models and read none. */
  protected assetsClear(): void {
    this.library.readerSet(null);
  }

  /**
   * Makes the library read the open project's models.
   *
   * @param generation Load generation the load belongs to.
   */
  protected async assetsLoad(generation: number): Promise<void> {
    if (!this.isCurrent(generation)) {
      return;
    }
    const control = this.hosts.control;
    this.library.readerSet((path) => control.projectModelRead(path), this.hosts.statusReport);
  }

  /**
   * Shows why the models could not be followed.
   *
   * @param reason Failure message.
   */
  protected loadFailureShow(reason: string): void {
    this.hosts.statusReport(reason);
  }
}
