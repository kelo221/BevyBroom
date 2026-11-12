import {
  projectWorkbenchOpenKeyRead,
  type ProjectWorkbenchOpenKeySource,
} from '@/project/workbench/project_workbench_open_key.js';

/** The parts of the project workbench an asset follower watches. */
export interface ProjectAssetFollowerWorkbench extends ProjectWorkbenchOpenKeySource {
  /**
   * Registers a callback run whenever the project status changes.
   *
   * @param listener Change callback.
   * @returns Function that removes the callback.
   */
  changeListenerAdd(listener: () => void): () => void;
}

/**
 * Keeps one kind of project asset (textures, sprinkle definitions, levels) in
 * step with the open project: whenever a project is opened, even the same one
 * again, the shown assets are cleared and loaded anew; when the project goes
 * away they are cleared. Results of a load overtaken by a newer project are
 * dropped. Subclasses call {@link followStart} once their fields are ready.
 */
export abstract class ProjectAssetFollower {
  private readonly workbench: ProjectAssetFollowerWorkbench;
  private listenerRemove: (() => void) | null = null;
  private shownProjectKey: string | null = null;
  private loadGeneration = 0;
  private pendingLoad: Promise<void> = Promise.resolve();

  /**
   * Remembers the workbench to follow without following it yet.
   *
   * @param workbench Workbench whose open project is followed.
   */
  protected constructor(workbench: ProjectAssetFollowerWorkbench) {
    this.workbench = workbench;
  }

  /**
   * Waits for the newest load to finish.
   *
   * @returns Promise that settles once the newest load is done.
   */
  idle(): Promise<void> {
    return this.pendingLoad;
  }

  /** Stops following the workbench and clears the shown assets. */
  dispose(): void {
    this.listenerRemove?.();
    this.listenerRemove = null;
    this.loadGeneration += 1;
    this.shownProjectKey = null;
    this.assetsClear();
  }

  /** Starts following the workbench and loads the project open right now. */
  protected followStart(): void {
    this.listenerRemove?.();
    this.listenerRemove = this.workbench.changeListenerAdd(() => this.projectChangeHandle());
    this.projectChangeHandle();
  }

  /**
   * Returns whether a load is still the newest one.
   *
   * @param generation Load generation to check.
   * @returns True while no newer load started.
   */
  protected isCurrent(generation: number): boolean {
    return generation === this.loadGeneration;
  }

  /** Clears the shown assets and loads the open project's assets again. */
  protected reload(): void {
    this.assetsClear();
    this.loadAgain();
  }

  /**
   * Loads the open project's assets again while the shown ones stay until the
   * new result replaces them; an older load still running is dropped.
   */
  protected loadAgain(): void {
    this.loadGeneration += 1;
    if (this.shownProjectKey !== null) {
      this.pendingLoad = this.loadRun(this.loadGeneration);
    }
  }

  /** Removes every shown asset. */
  protected abstract assetsClear(): void;

  /**
   * Loads the assets of the open project and shows them unless the load was
   * overtaken, which {@link isCurrent} tells.
   *
   * @param generation Load generation the load belongs to.
   */
  protected abstract assetsLoad(generation: number): Promise<void>;

  /**
   * Shows why a load failed.
   *
   * @param reason Failure message.
   */
  protected abstract loadFailureShow(reason: string): void;

  /** Clears and reloads when the open project differs from the shown one. */
  private projectChangeHandle(): void {
    const projectKey = projectWorkbenchOpenKeyRead(this.workbench);
    if (projectKey === this.shownProjectKey) {
      return;
    }
    this.shownProjectKey = projectKey;
    this.reload();
  }

  /**
   * Runs one load and reports failures instead of throwing.
   *
   * @param generation Load generation the load belongs to.
   */
  private async loadRun(generation: number): Promise<void> {
    try {
      await this.assetsLoad(generation);
    } catch (error) {
      if (this.isCurrent(generation)) {
        this.loadFailureShow(error instanceof Error ? error.message : String(error));
      }
    }
  }
}
