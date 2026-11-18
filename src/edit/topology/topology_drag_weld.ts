import type { CommandStack } from '@/commands/command_stack.js';
import type { EditSession } from '@/edit/session/edit_session.js';
import type { ComponentTransformCommitCleanup } from '@/edit/transform/component_transform_commit_cleanup.js';
import { CommandComponentTopology } from './command_component_topology.js';
import { commitTopologyWorkingMutation } from './topology_commit.js';
import { captureTopologySnapshot } from './topology_snapshot_capture.js';
import type { TopologySnapshot } from './topology_snapshot.js';
import { findEditDomainTargetById, resolveTopologyEditTarget } from './topology_target_resolve.js';
import type { TopologyEditTarget } from './topology_target.js';
import { mergeTopologyWorkingVertices } from './topology_vertex_merge.js';

/** Dependencies of the weld that runs after component drags. */
export interface TopologyDragWeldDependencies {
  /** Open Edit Mode session. */
  getSession: () => EditSession;
  /** Undo stack, or null. */
  getCommandStack: () => CommandStack | null;
  /** Refreshes cages and overlays after the weld. */
  refreshPresentation: () => void;
  /** Shows a status message. */
  showStatusMessage: (message: string) => void;
}

/**
 * Welds vertices a component drag dropped onto each other, so dragging an edge
 * of a box onto the opposite edge leaves a clean wedge instead of stacked
 * corners. The drag and the weld become one undo step.
 */
export class TopologyDragWeld implements ComponentTransformCommitCleanup {
  private readonly deps: TopologyDragWeldDependencies;
  private beforeSnapshots: TopologySnapshot[] = [];

  /**
   * Creates the weld.
   *
   * @param deps Session, undo and presentation callbacks.
   */
  constructor(deps: TopologyDragWeldDependencies) {
    this.deps = deps;
  }

  /** @inheritdoc */
  dragBegin(targetIds: readonly string[]): void {
    this.beforeSnapshots = this.targetsResolve(targetIds).map((target) => captureTopologySnapshot(target));
  }

  /** @inheritdoc */
  dragCommit(targetIds: readonly string[]): boolean {
    const targets = this.targetsResolve(targetIds);
    const weldedAny = targets.map((target) => this.targetWeld(target)).some((welded) => welded);
    if (!weldedAny) {
      this.beforeSnapshots = [];
      return false;
    }
    this.weldRecord(targets);
    this.deps.getSession().getComponentSelection().clear();
    this.deps.refreshPresentation();
    this.deps.showStatusMessage('Merged overlapping vertices');
    return true;
  }

  /**
   * Welds the coincident vertices of one target without recording undo.
   *
   * @param target Live target.
   * @returns True when vertices were welded.
   */
  private targetWeld(target: TopologyEditTarget): boolean {
    return commitTopologyWorkingMutation(target, null, (geometry) =>
      mergeTopologyWorkingVertices(geometry, [], 'by_distance'),
    ).applied;
  }

  /**
   * Records the drag and the weld as one undo step, from the state before the
   * drag to the state after the weld.
   *
   * @param targets Dragged targets.
   */
  private weldRecord(targets: readonly TopologyEditTarget[]): void {
    const after = targets.map((target) => captureTopologySnapshot(target));
    const refresh = (): void => this.deps.refreshPresentation();
    this.deps.getCommandStack()?.recordExecuted(new CommandComponentTopology(this.beforeSnapshots, after, refresh));
    this.beforeSnapshots = [];
  }

  /**
   * Resolves live targets by id from the open session.
   *
   * @param targetIds Target ids.
   * @returns Live targets that still exist.
   */
  private targetsResolve(targetIds: readonly string[]): TopologyEditTarget[] {
    const domain = this.deps.getSession().getDomain();
    const targets: TopologyEditTarget[] = [];
    for (const targetId of targetIds) {
      const domainTarget = findEditDomainTargetById(domain, targetId);
      const target = domainTarget ? resolveTopologyEditTarget(domainTarget) : null;
      if (target) {
        targets.push(target);
      }
    }
    return targets;
  }
}
