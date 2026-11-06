/** Listener notified when Block draw settings or mode change. */
export type StateBlockDrawSettingsListener = () => void;

/**
 * Shared state for Hammer++ Block tool activation and the Additive Hybrid
 * empty-space brush draw toggle in Object Select mode.
 */
export class StateBlockDrawSettings {
  private blockToolActive: boolean;
  private emptySpaceDrawInSelect: boolean;
  private readonly listeners: Set<StateBlockDrawSettingsListener>;

  /** Creates default settings (Block tool inactive, empty-space draw enabled). */
  constructor() {
    this.blockToolActive = false;
    this.emptySpaceDrawInSelect = true;
    this.listeners = new Set();
  }

  /**
   * Returns whether the dedicated Block tool is currently active.
   *
   * @returns True when Block tool is active.
   */
  blockToolActiveRead(): boolean {
    return this.blockToolActive;
  }

  /**
   * Sets whether the dedicated Block tool is active.
   *
   * @param active True when Block tool is active.
   */
  blockToolActiveWrite(active: boolean): void {
    if (this.blockToolActive === active) {
      return;
    }
    this.blockToolActive = active;
    this.listenersNotify();
  }

  /**
   * Returns whether empty-space drag in Object Select mode draws a brush.
   *
   * @returns True when empty-space draw is enabled in Object Select.
   */
  emptySpaceDrawInSelectRead(): boolean {
    return this.emptySpaceDrawInSelect;
  }

  /**
   * Sets whether empty-space drag in Object Select mode draws a brush.
   *
   * @param enabled True to allow empty-space brush drawing in Object Select.
   */
  emptySpaceDrawInSelectWrite(enabled: boolean): void {
    if (this.emptySpaceDrawInSelect === enabled) {
      return;
    }
    this.emptySpaceDrawInSelect = enabled;
    this.listenersNotify();
  }

  /**
   * Subscribes to settings changes.
   *
   * @param listener Callback invoked on change.
   * @returns Unsubscribe function.
   */
  changeListenerAdd(listener: StateBlockDrawSettingsListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Resets settings to defaults. */
  reset(): void {
    this.blockToolActive = false;
    this.emptySpaceDrawInSelect = true;
    this.listenersNotify();
  }

  /** Notifies all registered listeners. */
  private listenersNotify(): void {
    this.listeners.forEach((listener) => listener());
  }
}

let sharedBlockDrawSettings: StateBlockDrawSettings | null = null;

/**
 * Returns the process-wide Block draw settings singleton.
 *
 * @returns Shared StateBlockDrawSettings.
 */
export function getStateBlockDrawSettings(): StateBlockDrawSettings {
  if (!sharedBlockDrawSettings) {
    sharedBlockDrawSettings = new StateBlockDrawSettings();
  }
  return sharedBlockDrawSettings;
}

/**
 * Replaces the shared Block draw settings for unit tests.
 *
 * @param state State to install, or null to reset.
 */
export function setStateBlockDrawSettingsForTests(state: StateBlockDrawSettings | null): void {
  sharedBlockDrawSettings = state;
}
