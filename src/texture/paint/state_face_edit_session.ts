/** Hammer++ Face Edit Sheet click mode options. */
export type FaceEditPickMode = 'lift_select' | 'lift' | 'select' | 'apply';

/** Ordered list of Face Edit Sheet click modes for cycling or dropdowns. */
export const FACE_EDIT_PICK_MODES: readonly FaceEditPickMode[] = ['lift_select', 'lift', 'select', 'apply'];

/** Seed the Displacement tab's Apply Noise starts with. */
export const DISPLACEMENT_NOISE_SEED_DEFAULT = 1;

/** Listener notified when shared Face Edit Sheet session state changes. */
export type StateFaceEditSessionListener = () => void;

/**
 * Shared state between the docked FaceInspector, the floating Face Edit Sheet
 * (Material and Displacement tabs), and FaceSelectTool viewport click routing.
 */
export class StateFaceEditSession {
  private pickMode: FaceEditPickMode;
  private treatAsOne: boolean;
  private hideMask: boolean;
  private sheetOpen: boolean;
  private activeTabId: 'material' | 'displacement';
  private displacementNoiseSeed: number;
  private moreToolsExpanded: boolean;
  private readonly listeners: Set<StateFaceEditSessionListener>;

  /** Creates default Face Edit Sheet session state. */
  constructor() {
    this.pickMode = 'lift_select';
    this.treatAsOne = false;
    this.hideMask = false;
    this.sheetOpen = false;
    this.activeTabId = 'material';
    this.displacementNoiseSeed = DISPLACEMENT_NOISE_SEED_DEFAULT;
    this.moreToolsExpanded = false;
    this.listeners = new Set();
  }

  /**
   * Returns the active click mode (Lift+Select, Lift, Select, Apply).
   *
   * @returns Active FaceEditPickMode.
   */
  pickModeRead(): FaceEditPickMode {
    return this.pickMode;
  }

  /**
   * Updates the active click mode and notifies listeners.
   *
   * @param mode New FaceEditPickMode.
   */
  pickModeWrite(mode: FaceEditPickMode): void {
    if (this.pickMode === mode) {
      return;
    }
    this.pickMode = mode;
    this.listenersNotify();
  }

  /** Cycles to the next click mode in Hammer++ order. */
  pickModeCycle(): void {
    const index = FACE_EDIT_PICK_MODES.indexOf(this.pickMode);
    const next = FACE_EDIT_PICK_MODES[(index + 1) % FACE_EDIT_PICK_MODES.length] ?? 'lift_select';
    this.pickModeWrite(next);
  }

  /**
   * Returns whether multi-face Fit/Justify treats the selection as one UV
   * island.
   *
   * @returns True when Treat as one is enabled.
   */
  treatAsOneRead(): boolean {
    return this.treatAsOne;
  }

  /**
   * Sets whether multi-face Fit/Justify treats the selection as one UV island.
   *
   * @param enabled True to enable combined-bounds UV operations.
   */
  treatAsOneWrite(enabled: boolean): void {
    if (this.treatAsOne === enabled) {
      return;
    }
    this.treatAsOne = enabled;
    this.listenersNotify();
  }

  /**
   * Returns whether the orange face selection highlight mask is hidden.
   *
   * @returns True when mask overlay is hidden.
   */
  hideMaskRead(): boolean {
    return this.hideMask;
  }

  /**
   * Sets whether the orange face selection highlight mask is hidden.
   *
   * @param hidden True to hide the face selection overlay.
   */
  hideMaskWrite(hidden: boolean): void {
    if (this.hideMask === hidden) {
      return;
    }
    this.hideMask = hidden;
    this.listenersNotify();
  }

  /**
   * Returns whether the floating Face Edit Sheet is currently open.
   *
   * @returns True while open.
   */
  sheetOpenRead(): boolean {
    return this.sheetOpen;
  }

  /**
   * Sets whether the floating Face Edit Sheet is open.
   *
   * @param open True to open the sheet.
   */
  sheetOpenWrite(open: boolean): void {
    if (this.sheetOpen === open) {
      return;
    }
    this.sheetOpen = open;
    this.listenersNotify();
  }

  /**
   * Returns the active Face Edit Sheet tab id.
   *
   * @returns Active tab id ('material' or 'displacement').
   */
  activeTabIdRead(): 'material' | 'displacement' {
    return this.activeTabId;
  }

  /**
   * Sets the active Face Edit Sheet tab id.
   *
   * @param tabId Tab id to select.
   */
  activeTabIdWrite(tabId: 'material' | 'displacement'): void {
    if (this.activeTabId === tabId) {
      return;
    }
    this.activeTabId = tabId;
    this.listenersNotify();
  }

  /**
   * Returns the seed the Displacement tab's Apply Noise uses.
   *
   * @returns Non-negative integer seed.
   */
  displacementNoiseSeedRead(): number {
    return this.displacementNoiseSeed;
  }

  /**
   * Sets the seed the Displacement tab's Apply Noise uses.
   *
   * @param seed New seed; rounded to a non-negative integer.
   */
  displacementNoiseSeedWrite(seed: number): void {
    const wholeSeed = Number.isFinite(seed) ? Math.max(0, Math.round(seed)) : DISPLACEMENT_NOISE_SEED_DEFAULT;
    if (this.displacementNoiseSeed === wholeSeed) {
      return;
    }
    this.displacementNoiseSeed = wholeSeed;
    this.listenersNotify();
  }

  /**
   * Returns whether the Material tab's More tools section is expanded.
   *
   * @returns True while expanded.
   */
  moreToolsExpandedRead(): boolean {
    return this.moreToolsExpanded;
  }

  /**
   * Sets whether the Material tab's More tools section is expanded.
   *
   * @param expanded True to expand the section.
   */
  moreToolsExpandedWrite(expanded: boolean): void {
    if (this.moreToolsExpanded === expanded) {
      return;
    }
    this.moreToolsExpanded = expanded;
    this.listenersNotify();
  }

  /**
   * Subscribes to Face Edit Sheet session state changes.
   *
   * @param listener Callback invoked on change.
   * @returns Unsubscribe function.
   */
  changeListenerAdd(listener: StateFaceEditSessionListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Resets session state to defaults. */
  reset(): void {
    this.pickMode = 'lift_select';
    this.treatAsOne = false;
    this.hideMask = false;
    this.sheetOpen = false;
    this.activeTabId = 'material';
    this.displacementNoiseSeed = DISPLACEMENT_NOISE_SEED_DEFAULT;
    this.moreToolsExpanded = false;
    this.listenersNotify();
  }

  /** Invokes all registered listeners. */
  private listenersNotify(): void {
    this.listeners.forEach((listener) => listener());
  }
}

let sharedFaceEditSession: StateFaceEditSession | null = null;

/**
 * Returns the process-wide Face Edit Sheet session state singleton.
 *
 * @returns Shared StateFaceEditSession.
 */
export function getStateFaceEditSession(): StateFaceEditSession {
  if (!sharedFaceEditSession) {
    sharedFaceEditSession = new StateFaceEditSession();
  }
  return sharedFaceEditSession;
}

/**
 * Replaces the shared Face Edit Sheet session state for tests.
 *
 * @param state State to install, or null to clear.
 */
export function setStateFaceEditSessionForTests(state: StateFaceEditSession | null): void {
  sharedFaceEditSession = state;
}
