import { StateCordon } from '@/cordon/state_cordon.js';
import { CordonFilterApplier } from '@/cordon/cordon_filter_applier.js';
import { VisibilityHideLedger } from './visibility/visibility_hide_ledger.js';
import { VisGroupStore } from './visgroup_store.js';

/** VisGroup and Cordon services of the editor, sharing one hide ledger. */
export interface VisGroupSharedServices {
  /** Ledger both VisGroups and the Cordon hide objects through. */
  readonly hideLedger: VisibilityHideLedger;
  /** User and automatic VisGroups with their membership and visibility. */
  readonly visGroupStore: VisGroupStore;
  /** Cordon active flag and bounds. */
  readonly cordonState: StateCordon;
  /** Hides the objects outside the Cordon while it is active. */
  readonly cordonFilterApplier: CordonFilterApplier;
}

let sharedVisGroupServices: VisGroupSharedServices | null = null;

/**
 * Creates VisGroup and Cordon services that hide objects through one ledger.
 *
 * @returns New services.
 */
export function visGroupSharedServicesCreate(): VisGroupSharedServices {
  const hideLedger = new VisibilityHideLedger();
  const cordonState = new StateCordon();
  return {
    hideLedger,
    visGroupStore: new VisGroupStore(hideLedger),
    cordonState,
    cordonFilterApplier: new CordonFilterApplier(cordonState, hideLedger),
  };
}

/**
 * Returns the process-wide VisGroup and Cordon services.
 *
 * @returns Shared services.
 */
export function getVisGroupSharedServices(): VisGroupSharedServices {
  sharedVisGroupServices ??= visGroupSharedServicesCreate();
  return sharedVisGroupServices;
}

/**
 * Replaces the shared VisGroup and Cordon services (tests only).
 *
 * @param services Services to install, or null to create new ones on next use.
 */
export function setVisGroupSharedServicesForTests(services: VisGroupSharedServices | null): void {
  sharedVisGroupServices = services;
}
