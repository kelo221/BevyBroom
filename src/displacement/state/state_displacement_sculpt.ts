import {
  DISPLACEMENT_ALPHA_MAX,
  type DisplacementActiveTool,
  type DisplacementPower,
  type DisplacementSculptAxis,
  type DisplacementSculptEdge,
  type DisplacementSculptEffect,
} from '@/displacement/model/displacement_types.js';

/** Smallest paint radius in meters. */
export const DISPLACEMENT_SCULPT_RADIUS_MIN = 0.01;

/** Largest paint radius in meters the Radius slider and brush resizing offer. */
export const DISPLACEMENT_SCULPT_RADIUS_MAX = 32;

/** Settings of the Displacement tab shared by the panel and viewport sculpting. */
export interface DisplacementSculptSettings {
  /** Power used by Create. */
  power: DisplacementPower;
  /** Viewport tool presses on displaced faces use. */
  activeTool: DisplacementActiveTool;
  /** Paint Geometry effect. */
  effect: DisplacementSculptEffect;
  /**
   * Whether dabs weigh every vertex in the radius (off: only the nearest
   * vertex).
   */
  spatial: boolean;
  /** Direction dabs move vertices along. */
  axis: DisplacementSculptAxis;
  /** Dab falloff. */
  edge: DisplacementSculptEdge;
  /**
   * Whether each stroke sews the shared edges of the painted faces when it
   * ends.
   */
  autoSew: boolean;
  /** Whether a held button keeps painting at the last point every frame. */
  continuousMouse: boolean;
  /** Alpha Paint Alpha paints towards, 0 to DISPLACEMENT_ALPHA_MAX. */
  alphaValue: number;
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
    activeTool: 'select',
    effect: 'raise_lower',
    spatial: true,
    axis: 'face_normal',
    edge: 'soft',
    autoSew: false,
    continuousMouse: false,
    alphaValue: DISPLACEMENT_ALPHA_MAX,
    raise: true,
    radius: 1,
    distance: 0.1,
    noiseMin: -0.1,
    noiseMax: 0.1,
  };
}

/**
 * Clamps a paint alpha value to the stored alpha range.
 *
 * @param alphaValue Candidate alpha value.
 * @returns Alpha between 0 and DISPLACEMENT_ALPHA_MAX; non-finite values become
 *   the maximum.
 */
function displacementSculptAlphaValueClamp(alphaValue: number): number {
  if (!Number.isFinite(alphaValue)) {
    return DISPLACEMENT_ALPHA_MAX;
  }
  return Math.min(DISPLACEMENT_ALPHA_MAX, Math.max(0, alphaValue));
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
   * Changes some settings and notifies listeners. The alpha value is clamped to
   * 0 to DISPLACEMENT_ALPHA_MAX.
   *
   * @param changes Settings to change.
   */
  settingsWrite(changes: Partial<DisplacementSculptSettings>): void {
    const merged = { ...this.settings, ...changes };
    this.settings = { ...merged, alphaValue: displacementSculptAlphaValueClamp(merged.alphaValue) };
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
