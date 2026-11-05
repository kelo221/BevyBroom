import type {
  SprinkleConfig,
  SprinkleSamplePoint,
  SprinkleSurfaceHit,
  SprinkleWeightedEntry,
} from './sprinkle_types.js';
import { SprinkleSurfaceSampler, type SprinkleSurfaceRayProjector } from './sprinkle_surface_sampler.js';

/** Listener notified when the Sprinkle tool configuration changes. */
export type StateSprinkleToolListener = () => void;

/**
 * Holds the active configuration, weighted entries, and stamp execution
 * delegate for the Hammer++ Sprinkle surface scatter tool.
 */
export class StateSprinkleTool {
  private toolActive: boolean;
  private config: SprinkleConfig;
  private entries: SprinkleWeightedEntry[];
  private stampDelegate:
    ((samples: readonly SprinkleSamplePoint[], centerHit: SprinkleSurfaceHit, config: SprinkleConfig) => number) | null;
  private clientPointHandler: ((clientX: number, clientY: number) => boolean) | null;
  private readonly listeners: Set<StateSprinkleToolListener>;

  /** Creates a default Sprinkle tool state. */
  constructor() {
    this.toolActive = false;
    this.config = {
      radius: 4,
      density: 5,
      gridStepX: 0,
      gridStepZ: 0,
      mode: 'ADDITIVE',
      alignToNormal: true,
      randomYaw: true,
      scaleMin: 0.9,
      scaleMax: 1.1,
      seed: 1337,
    };
    this.entries = [];
    this.stampDelegate = null;
    this.clientPointHandler = null;
    this.listeners = new Set();
  }

  /**
   * Returns whether the Sprinkle scatter tool is currently active.
   *
   * @returns True when active.
   */
  toolActiveRead(): boolean {
    return this.toolActive;
  }

  /**
   * Sets whether the Sprinkle scatter tool is currently active.
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
   * Registers the viewport client-point scatter callback.
   *
   * @param handler Callback executing a scatter stamp at `(clientX, clientY)`.
   */
  clientPointHandlerWrite(handler: ((clientX: number, clientY: number) => boolean) | null): void {
    this.clientPointHandler = handler;
  }

  /**
   * Executes a scatter stamp at a viewport client point.
   *
   * @param clientX Viewport client X.
   * @param clientY Viewport client Y.
   * @returns True when handled.
   */
  scatterAtClientPoint(clientX: number, clientY: number): boolean {
    if (!this.clientPointHandler) {
      return false;
    }
    return this.clientPointHandler(clientX, clientY);
  }

  /**
   * Returns a snapshot of the current Sprinkle configuration.
   *
   * @returns Current SprinkleConfig.
   */
  configRead(): SprinkleConfig {
    return { ...this.config };
  }

  /**
   * Merges partial updates into the Sprinkle configuration.
   *
   * @param patch Partial configuration fields to update.
   */
  configPatch(patch: Partial<SprinkleConfig>): void {
    this.config = { ...this.config, ...patch };
    this.listenersNotify();
  }

  /**
   * Returns the weighted catalog entries used for scatter selection.
   *
   * @returns Weighted entries.
   */
  entriesRead(): readonly SprinkleWeightedEntry[] {
    return this.entries;
  }

  /**
   * Replaces the weighted catalog entries used for scatter selection.
   *
   * @param entries Weighted entries.
   */
  entriesWrite(entries: readonly SprinkleWeightedEntry[]): void {
    this.entries = entries.map((e) => ({ ...e }));
    this.listenersNotify();
  }

  /**
   * Registers the scene instantiation delegate invoked on each scatter stamp.
   *
   * @param delegate Callback that instantiates or removes objects in the scene.
   */
  stampDelegateWrite(
    delegate:
      | ((samples: readonly SprinkleSamplePoint[], centerHit: SprinkleSurfaceHit, config: SprinkleConfig) => number)
      | null,
  ): void {
    this.stampDelegate = delegate;
  }

  /**
   * Executes one scatter stamp at `centerHit` and advances the deterministic
   * seed.
   *
   * @param centerHit Brush center surface hit.
   * @param projector Optional surface raycast callback.
   * @returns Generated samples.
   */
  stampAtHit(centerHit: SprinkleSurfaceHit, projector?: SprinkleSurfaceRayProjector): SprinkleSamplePoint[] {
    const samples = SprinkleSurfaceSampler.sampleStamp(centerHit, this.config, this.entries, projector);
    this.stampDelegate?.(samples, centerHit, this.config);
    this.config.seed = (this.config.seed + 1) | 0;
    return samples;
  }

  /**
   * Subscribes to Sprinkle configuration changes.
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
