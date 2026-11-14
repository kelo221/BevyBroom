import { describe, expect, it } from 'vitest';
import { ProjectAssetFollower, type ProjectAssetFollowerWorkbench } from '@/project/assets/project_asset_follower.js';
import { workbenchRigCreate } from '../workbench/project_workbench_rig.js';

/**
 * Follower that records every clear, load and failure and lets the test release
 * loads.
 */
class ProjectAssetFollowerRecording extends ProjectAssetFollower {
  readonly events: string[] = [];
  readonly pendingReleases: ((value: string) => void)[] = [];
  shouldThrow = false;

  /**
   * Creates the follower over a workbench and starts following it.
   *
   * @param workbench Workbench whose open project is followed.
   */
  constructor(workbench: ProjectAssetFollowerWorkbench) {
    super(workbench);
    this.followStart();
  }

  /** Clears and reloads the open project. */
  reloadNow(): void {
    this.reload();
  }

  /** Loads the open project again without clearing. */
  loadAgainNow(): void {
    this.loadAgain();
  }

  /** @inheritdoc */
  protected assetsClear(): void {
    this.events.push('clear');
  }

  /** @inheritdoc */
  protected async assetsLoad(generation: number): Promise<void> {
    if (this.shouldThrow) {
      throw new Error('unplugged');
    }
    const value = await new Promise<string>((resolve) => this.pendingReleases.push(resolve));
    this.events.push(this.isCurrent(generation) ? `show ${value}` : `drop ${value}`);
  }

  /** @inheritdoc */
  protected loadFailureShow(reason: string): void {
    this.events.push(`fail ${reason}`);
  }
}

/** Unit tests for the shared project asset follower. */
describe('ProjectAssetFollower', () => {
  it('loads nothing before a project opens and clears once when disposed', () => {
    const rig = workbenchRigCreate();
    const follower = new ProjectAssetFollowerRecording(rig.workbench);
    expect(follower.events).toEqual([]);
    follower.dispose();
    expect(follower.events).toEqual(['clear']);
  });

  it('clears and loads on every project open, even the same project again', async () => {
    const rig = workbenchRigCreate();
    const follower = new ProjectAssetFollowerRecording(rig.workbench);
    await rig.workbench.projectOpen('/games/first/broom.project.json');
    follower.pendingReleases.shift()?.('first');
    await follower.idle();
    await rig.workbench.projectOpen('/games/first/broom.project.json');
    follower.pendingReleases.shift()?.('again');
    await follower.idle();
    expect(follower.events).toEqual(['clear', 'show first', 'clear', 'show again']);
  });

  it('drops a load overtaken by a newer project or an explicit reload', async () => {
    const rig = workbenchRigCreate();
    const follower = new ProjectAssetFollowerRecording(rig.workbench);
    await rig.workbench.projectOpen('/games/old/broom.project.json');
    await rig.workbench.projectOpen('/games/new/broom.project.json');
    follower.reloadNow();
    const releases = follower.pendingReleases.splice(0);
    releases[0]?.('old');
    releases[1]?.('new');
    releases[2]?.('reloaded');
    await follower.idle();
    expect(follower.events.filter((event) => event !== 'clear')).toEqual(['drop old', 'drop new', 'show reloaded']);
    expect(follower.events.filter((event) => event === 'clear')).toHaveLength(3);
  });

  it('loads again without clearing and does nothing without a project', async () => {
    const rig = workbenchRigCreate();
    const follower = new ProjectAssetFollowerRecording(rig.workbench);
    follower.loadAgainNow();
    expect(follower.pendingReleases).toHaveLength(0);
    await rig.workbench.projectOpen('/games/kept/broom.project.json');
    follower.pendingReleases.shift()?.('first');
    await follower.idle();
    follower.loadAgainNow();
    follower.pendingReleases.shift()?.('second');
    await follower.idle();
    expect(follower.events).toEqual(['clear', 'show first', 'show second']);
  });

  it('reports a failing load only while it is still the newest one', async () => {
    const rig = workbenchRigCreate();
    const follower = new ProjectAssetFollowerRecording(rig.workbench);
    follower.shouldThrow = true;
    await rig.workbench.projectOpen('/games/failing/broom.project.json');
    await follower.idle();
    expect(follower.events).toEqual(['clear', 'fail unplugged']);
  });
});
