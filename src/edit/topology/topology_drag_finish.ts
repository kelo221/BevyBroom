import type { CommandStack } from '@/commands/command_stack.js';
import type { EditSession } from '@/edit/session/edit_session.js';
import type { ComponentTransformCommitCleanup } from '@/edit/transform/component_transform_commit_cleanup.js';
import { CommandComponentTopology } from './command_component_topology.js';
import { commitTopologyWorkingMutation } from './topology_commit.js';
import { topologyDragBrushConvexResolve } from './topology_drag_brush_convex.js';
import {
  topologyOperatorApplied,
  topologyOperatorRefused,
  type TopologyOperatorResult,
} from './topology_operator_result.js';
import { captureTopologySnapshot } from './topology_snapshot_capture.js';
import { restoreTopologySnapshot } from './topology_snapshot_restore.js';
import type { TopologySnapshot } from './topology_snapshot.js';
import { findEditDomainTargetById, resolveTopologyEditTarget } from './topology_target_resolve.js';
import type { TopologyEditTarget } from './topology_target.js';
import type { TopologyWorkingGeometry } from './topology_working_geometry.js';
import { mergeTopologyWorkingVertices } from './topology_vertex_merge.js';

/** Dependencies of the work that finishes component drags. */
export interface TopologyDragFinishDependencies {
  /** Open Edit Mode session. */
  getSession: () => EditSession;
  /** Undo stack, or null. */
  getCommandStack: () => CommandStack | null;
  /** Refreshes cages and overlays after a change. */
  refreshPresentation: () => void;
  /** Shows a status message. */
  showStatusMessage: (message: string) => void;
}

/** How one dragged target ended. */
type TopologyDragFinishTargetOutcome = 'unchanged' | 'changed' | 'not_convex';

/** Status shown when a drag is undone because a brush would stop being convex. */
export const TOPOLOGY_DRAG_FINISH_NOT_CONVEX_MESSAGE = 'Move undone: the brush would not be convex';

/**
 * Finishes component drags so brushes stay clean convex solids: corners the
 * drag dropped onto each other merge (a box edge dropped on the opposite edge
 * becomes a wedge), bent faces split into flat ones, and a drag that would
 * leave a brush self-crossing or dented is undone. The drag and its cleanup are
 * one undo step.
 */
export class TopologyDragFinish implements ComponentTransformCommitCleanup {
  private readonly deps: TopologyDragFinishDependencies;
  private beforeSnapshots: TopologySnapshot[] = [];

  /**
   * Creates the drag finish.
   *
   * @param deps Session, undo and presentation callbacks.
   */
  constructor(deps: TopologyDragFinishDependencies) {
    this.deps = deps;
  }

  /** @inheritdoc */
  dragBegin(targetIds: readonly string[]): void {
    this.beforeSnapshots = this.targetsResolve(targetIds).map((target) => captureTopologySnapshot(target));
  }

  /** @inheritdoc */
  dragCommit(targetIds: readonly string[]): boolean {
    const targets = this.targetsResolve(targetIds);
    const outcomes = targets.map((target) => this.targetFinish(target));
    if (outcomes.includes('not_convex')) {
      this.dragRevert();
      return true;
    }
    if (!outcomes.includes('changed')) {
      this.beforeSnapshots = [];
      return false;
    }
    this.dragRecord(targets);
    return true;
  }

  /**
   * Cleans up one dragged target without recording undo.
   *
   * @param target Live target.
   * @returns Whether the target changed, stayed or cannot stay convex.
   */
  private targetFinish(target: TopologyEditTarget): TopologyDragFinishTargetOutcome {
    let outcome: TopologyDragFinishTargetOutcome = 'unchanged';
    commitTopologyWorkingMutation(target, null, (geometry) => {
      outcome = this.geometryFinish(target, geometry);
      return outcome === 'changed' ? topologyOperatorApplied() : topologyOperatorRefused('');
    });
    return outcome;
  }

  /**
   * Merges overlapping corners and, for brushes, keeps the solid convex.
   *
   * @param target Live target.
   * @param geometry Working geometry, edited in place.
   * @returns Outcome for the target.
   */
  private geometryFinish(
    target: TopologyEditTarget,
    geometry: TopologyWorkingGeometry,
  ): TopologyDragFinishTargetOutcome {
    const welded: TopologyOperatorResult = mergeTopologyWorkingVertices(geometry, [], 'by_distance');
    if (target.kind !== 'brush') {
      return welded.applied ? 'changed' : 'unchanged';
    }
    const convex = topologyDragBrushConvexResolve(geometry);
    if (convex === 'not_convex') {
      return 'not_convex';
    }
    return welded.applied || convex === 'rebuilt' ? 'changed' : 'unchanged';
  }

  /** Puts every dragged target back as it was before the drag. */
  private dragRevert(): void {
    this.beforeSnapshots.forEach((snapshot) => restoreTopologySnapshot(snapshot));
    this.beforeSnapshots = [];
    this.deps.refreshPresentation();
    this.deps.showStatusMessage(TOPOLOGY_DRAG_FINISH_NOT_CONVEX_MESSAGE);
  }

  /**
   * Records the drag and its cleanup as one undo step and drops the component
   * selection, whose indices changed.
   *
   * @param targets Dragged targets.
   */
  private dragRecord(targets: readonly TopologyEditTarget[]): void {
    const after = targets.map((target) => captureTopologySnapshot(target));
    const refresh = (): void => this.deps.refreshPresentation();
    this.deps.getCommandStack()?.recordExecuted(new CommandComponentTopology(this.beforeSnapshots, after, refresh));
    this.beforeSnapshots = [];
    this.deps.getSession().getComponentSelection().clear();
    this.deps.refreshPresentation();
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
