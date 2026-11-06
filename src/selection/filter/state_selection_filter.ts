import { SelectionFilterMode } from '@/types/selection_filter_mode.js';

/**
 * Listener notified when the selection filter mode or ignore-groups toggle
 * changes.
 */
export type StateSelectionFilterListener = () => void;

/**
 * Shared state for Hammer++'s Groups / Objects / Solids selection filter triad
 * and the top-toolbar Ignore Groups (ig) toggle.
 */
export class StateSelectionFilter {
  private mode: SelectionFilterMode;
  private ignoreGroups: boolean;
  private readonly listeners: Set<StateSelectionFilterListener>;

  /** Creates a selection filter state defaulting to Objects mode. */
  constructor() {
    this.mode = SelectionFilterMode.OBJECTS;
    this.ignoreGroups = false;
    this.listeners = new Set();
  }

  /**
   * Returns the selected triad mode.
   *
   * @returns Current SelectionFilterMode.
   */
  modeRead(): SelectionFilterMode {
    return this.mode;
  }

  /**
   * Sets the active triad mode and notifies listeners.
   *
   * @param mode New SelectionFilterMode.
   */
  modeWrite(mode: SelectionFilterMode): void {
    if (this.mode === mode) {
      return;
    }
    this.mode = mode;
    this.listenersNotify();
  }

  /**
   * Returns whether Ignore Groups (ig) is enabled.
   *
   * @returns True when group wrappers are bypassed during picking.
   */
  ignoreGroupsRead(): boolean {
    return this.ignoreGroups;
  }

  /**
   * Sets whether Ignore Groups (ig) is enabled.
   *
   * @param enabled True to bypass group roots when picking.
   */
  ignoreGroupsWrite(enabled: boolean): void {
    if (this.ignoreGroups === enabled) {
      return;
    }
    this.ignoreGroups = enabled;
    this.listenersNotify();
  }

  /**
   * Returns the effective pick mode after applying the Ignore Groups override.
   *
   * @returns Effective SelectionFilterMode for viewport raycasts.
   */
  effectiveModeRead(): SelectionFilterMode {
    if (this.ignoreGroups && this.mode === SelectionFilterMode.GROUPS) {
      return SelectionFilterMode.OBJECTS;
    }
    return this.mode;
  }

  /**
   * Subscribes to filter state changes.
   *
   * @param listener Callback invoked on change.
   * @returns Unsubscribe function.
   */
  changeListenerAdd(listener: StateSelectionFilterListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Resets filter state to defaults. */
  reset(): void {
    this.mode = SelectionFilterMode.OBJECTS;
    this.ignoreGroups = false;
    this.listenersNotify();
  }

  /** Notifies all registered listeners. */
  private listenersNotify(): void {
    this.listeners.forEach((listener) => listener());
  }
}

let sharedSelectionFilterState: StateSelectionFilter | null = null;

/**
 * Returns the process-wide selection filter state singleton.
 *
 * @returns Shared StateSelectionFilter instance.
 */
export function getStateSelectionFilter(): StateSelectionFilter {
  if (!sharedSelectionFilterState) {
    sharedSelectionFilterState = new StateSelectionFilter();
  }
  return sharedSelectionFilterState;
}

/**
 * Replaces the shared selection filter state for unit tests.
 *
 * @param state State instance to install, or null to reset.
 */
export function setStateSelectionFilterForTests(state: StateSelectionFilter | null): void {
  sharedSelectionFilterState = state;
}
