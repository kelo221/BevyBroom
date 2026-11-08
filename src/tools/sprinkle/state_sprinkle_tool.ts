import type { SprinkleConfig } from './sprinkle_types.js';

/** Listener notified when the Sprinkle tool configuration changes. */
export type StateSprinkleToolListener = () => void;

/**
 * Holds whether the Hammer++ Entity Sprinkle tool is active and its
 * configuration.
 */
export class StateSprinkleTool {
  private toolActive: boolean;
  private config: SprinkleConfig;
  private readonly listeners: Set<StateSprinkleToolListener>;

  /** Creates an inactive Sprinkle tool state with the default configuration. */
  constructor() {
    this.toolActive = false;
    this.config = StateSprinkleTool.configDefaultCreate();
    this.listeners = new Set();
  }

  /**
   * Returns the configuration a fresh Sprinkle tool starts with.
   *
   * @returns Default configuration.
   */
  static configDefaultCreate(): SprinkleConfig {
    return {
      definitionName: null,
      radius: 4,
      densityPercent: 25,
      mode: 'ADDITIVE',
      gridOffsetU: 0,
      gridOffsetV: 0,
      gridSizeU: 1,
      gridSizeV: 1,
      gridSizeFromDefinition: true,
      randomYaw: false,
      alignToNormal: false,
      seed: 1337,
    };
  }

  /**
   * Returns whether the Sprinkle tool is currently active.
   *
   * @returns True when active.
   */
  toolActiveRead(): boolean {
    return this.toolActive;
  }

  /**
   * Sets whether the Sprinkle tool is currently active.
   *
   * @param active True when active.
   */
  toolActiveWrite(active: boolean): void {
    if (this.toolActive === active) {
      return;
    }
    this.toolActive = active;
    this.listenersNotify();
  }

  /**
   * Returns a snapshot of the current configuration.
   *
   * @returns Configuration copy.
   */
  configRead(): SprinkleConfig {
    return { ...this.config };
  }

  /**
   * Merges partial updates into the configuration.
   *
   * @param patch Configuration fields to update.
   */
  configPatch(patch: Partial<SprinkleConfig>): void {
    this.config = { ...this.config, ...patch };
    this.listenersNotify();
  }

  /**
   * Subscribes to Sprinkle tool changes.
   *
   * @param listener Change callback.
   * @returns Unsubscribe function.
   */
  changeListenerAdd(listener: StateSprinkleToolListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Restores the default configuration and the inactive state. */
  reset(): void {
    this.toolActive = false;
    this.config = StateSprinkleTool.configDefaultCreate();
    this.listenersNotify();
  }

  /** Notifies all registered listeners. */
  private listenersNotify(): void {
    this.listeners.forEach((listener) => listener());
  }
}

let sharedSprinkleToolState: StateSprinkleTool | null = null;

/**
 * Returns the shared Sprinkle tool state singleton.
 *
 * @returns Shared StateSprinkleTool.
 */
export function getStateSprinkleTool(): StateSprinkleTool {
  if (!sharedSprinkleToolState) {
    sharedSprinkleToolState = new StateSprinkleTool();
  }
  return sharedSprinkleToolState;
}
