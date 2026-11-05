import type { DisplacementPower, DisplacementSculptTool } from '@/displacement/model/displacement_types.js';

/** Settings of the Displacement tab shared by the panel and viewport sculpting. */
export interface DisplacementSculptSettings {
  /** Power used by Create. */
  power: DisplacementPower;
  /** Whether viewport drags paint geometry on displaced faces. */
  paintEnabled: boolean;
  /** Active paint tool. */
  tool: DisplacementSculptTool;
  /** Whether Raise/Lower raises (lowers while Ctrl is held). */
  raise: boolean;
  /** Paint radius in meters. */
  radius: number;
  /** Distance in meters one dab moves the center vertex. */
  distance: number;
  /** Smallest distance Noise adds, in meters. */
  noiseMin: number;
  /** Largest distance Noise adds, in meters. */
  noiseMax: number;
}

/** Listener notified when displacement sculpt settings change. */
export type StateDisplacementSculptListener = () => void;

/**
 * Returns the default Displacement tab settings.
 *
 * @returns New default settings.
 */
function displacementSculptSettingsDefault(): DisplacementSculptSettings {
  return {
    power: 3,
    paintEnabled: false,
    tool: 'raise_lower',
    raise: true,
    radius: 1,
    distance: 0.1,
    noiseMin: -0.1,
    noiseMax: 0.1,
  };
}

/** Shared Displacement tab settings with change listeners. */
export class StateDisplacementSculpt {
  private settings: DisplacementSculptSettings = displacementSculptSettingsDefault();
  private readonly listeners = new Set<StateDisplacementSculptListener>();

  /**
   * Returns the current settings.
   *
   * @returns Read-only settings snapshot.
   */
  settingsRead(): Readonly<DisplacementSculptSettings> {
    return this.settings;
  }

  /**
   * Changes some settings and notifies listeners.
   *
   * @param changes Settings to change.
   */
  settingsWrite(changes: Partial<DisplacementSculptSettings>): void {
    this.settings = { ...this.settings, ...changes };
    this.listeners.forEach((listener) => listener());
  }

  /**
   * Subscribes to settings changes.
   *
   * @param listener Callback invoked on change.
   * @returns Unsubscribe function.
   */
  changeListenerAdd(listener: StateDisplacementSculptListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Restores the default settings and notifies listeners. */
  reset(): void {
    this.settingsWrite(displacementSculptSettingsDefault());
  }
}

let sharedDisplacementSculptState: StateDisplacementSculpt | null = null;

/**
 * Returns the process-wide Displacement tab settings.
 *
 * @returns Shared state.
 */
export function getStateDisplacementSculpt(): StateDisplacementSculpt {
  if (!sharedDisplacementSculptState) {
    sharedDisplacementSculptState = new StateDisplacementSculpt();
  }
  return sharedDisplacementSculptState;
}
