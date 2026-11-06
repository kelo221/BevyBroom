import type * as THREE from 'three';
import { VisibilityHideLedger } from '@/visgroup/visibility/visibility_hide_ledger.js';
import { VisGroupObjectCollector } from '@/visgroup/visgroup_object_collector.js';
import type { StateCordon } from './state_cordon.js';

/** Ledger reason key used when hiding objects outside the Cordon volume. */
const CORDON_HIDE_REASON = 'cordon:outside_bounds';

/**
 * Applies Hammer++ Cordon visibility filtering to a scene world root using a
 * shared VisibilityHideLedger so pre-cordon visibility is restored on disable.
 */
export class CordonFilterApplier {
  private readonly state: StateCordon;
  private readonly hideLedger: VisibilityHideLedger;

  /**
   * Creates a Cordon filter applier.
   *
   * @param state Cordon state source.
   * @param hideLedger Shared hide ledger.
   */
  constructor(state: StateCordon, hideLedger: VisibilityHideLedger = new VisibilityHideLedger()) {
    this.state = state;
    this.hideLedger = hideLedger;
  }

  /**
   * Evaluates all logical objects under worldRoot against the current Cordon
   * state and hides objects outside the box while Cordon is enabled.
   *
   * @param worldRoot Scene world root.
   */
  apply(worldRoot: THREE.Object3D): void {
    if (!this.state.enabledRead()) {
      this.hideLedger.hideReasonRemoveAll(CORDON_HIDE_REASON);
      return;
    }
    const outside = VisGroupObjectCollector.logicalObjectsCollect(worldRoot).filter(
      (object) => !this.state.intersectsObject(object),
    );
    this.hideLedger.hideReasonReplace(CORDON_HIDE_REASON, outside);
  }
}
