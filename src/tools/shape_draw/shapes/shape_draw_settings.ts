import { SHAPE_DRAW_DEFAULT_SHAPE_ID, shapeDrawShapeFind } from './shape_draw_shape_registry.js';
import type {
  ShapeDrawShapeParameter,
  ShapeDrawShapeParameterValue,
  ShapeDrawShapeParameterValues,
} from './shape_draw_shape_parameter.js';

/** Listener invoked after the selected shape or any parameter changed. */
export type ShapeDrawSettingsChangeListener = () => void;

/**
 * Holds the shape the draw tool creates and the parameter values of every
 * shape, with change listeners.
 */
export class ShapeDrawSettings {
  private selectedShapeId: string;
  private readonly parameterValues: Map<string, ShapeDrawShapeParameterValues>;
  private readonly changeListeners: Set<ShapeDrawSettingsChangeListener>;

  /** Creates settings with every shape at its defaults. */
  constructor() {
    this.selectedShapeId = SHAPE_DRAW_DEFAULT_SHAPE_ID;
    this.parameterValues = new Map();
    this.changeListeners = new Set();
  }

  /**
   * Returns the id of the shape the draw tool creates.
   *
   * @returns Shape id.
   */
  getSelectedShapeId(): string {
    return this.selectedShapeId;
  }

  /**
   * Selects the shape the draw tool creates.
   *
   * @param shapeId Shape identifier.
   */
  shapeSelect(shapeId: string): void {
    if (shapeId === this.selectedShapeId) {
      return;
    }
    this.selectedShapeId = shapeId;
    this.changeListenersNotify();
  }

  /**
   * Returns the parameter values stored for a shape.
   *
   * @param shapeId Shape identifier.
   * @returns Values keyed by parameter id (missing keys use shape defaults).
   */
  parameterValuesRead(shapeId: string): ShapeDrawShapeParameterValues {
    const stored = this.parameterValues.get(shapeId);
    return stored ? { ...stored } : {};
  }

  /**
   * Stores one parameter value of a shape.
   *
   * @param shapeId Shape identifier.
   * @param parameterId Parameter identifier.
   * @param value Value to store.
   */
  parameterSet(shapeId: string, parameterId: string, value: ShapeDrawShapeParameterValue): void {
    const values = this.parameterValues.get(shapeId) ?? {};
    if (values[parameterId] === value) {
      return;
    }
    values[parameterId] = value;
    this.parameterValues.set(shapeId, values);
    this.changeListenersNotify();
  }

  /**
   * Adds a listener invoked after any setting changed.
   *
   * @param listener Callback.
   */
  changeListenerAdd(listener: ShapeDrawSettingsChangeListener): void {
    this.changeListeners.add(listener);
  }

  /**
   * Removes a change listener.
   *
   * @param listener Callback.
   */
  changeListenerRemove(listener: ShapeDrawSettingsChangeListener): void {
    this.changeListeners.delete(listener);
  }

  /** Restores the default shape and clears every stored value. */
  reset(): void {
    this.selectedShapeId = SHAPE_DRAW_DEFAULT_SHAPE_ID;
    this.parameterValues.clear();
    this.changeListenersNotify();
  }

  /**
   * Lists the parameters of a shape with their current values.
   *
   * @param shapeId Shape identifier.
   * @returns Descriptors with values attached.
   */
  parameterStatesList(shapeId: string): ShapeDrawParameterState[] {
    const shape = shapeDrawShapeFind(shapeId);
    const values = this.parameterValuesRead(shape.id);
    return shape.parameterDescriptors().map((parameter) => ({
      parameter,
      value: values[parameter.id] ?? parameter.defaultValue,
    }));
  }

  /** Runs every change listener. */
  private changeListenersNotify(): void {
    for (const listener of this.changeListeners) {
      listener();
    }
  }
}

/** One shape parameter paired with the value currently in effect. */
export interface ShapeDrawParameterState {
  /** Parameter descriptor. */
  parameter: ShapeDrawShapeParameter;
  /** Value stored in the settings, or the parameter default. */
  value: ShapeDrawShapeParameterValue;
}

let sharedShapeDrawSettings: ShapeDrawSettings | null = null;

/**
 * Returns the process-wide shape draw settings singleton.
 *
 * @returns Shared settings.
 */
export function getShapeDrawSettings(): ShapeDrawSettings {
  if (!sharedShapeDrawSettings) {
    sharedShapeDrawSettings = new ShapeDrawSettings();
  }
  return sharedShapeDrawSettings;
}

/**
 * Replaces the shared settings (tests only).
 *
 * @param settings Settings to install, or null to clear.
 */
export function setShapeDrawSettingsForTests(settings: ShapeDrawSettings | null): void {
  sharedShapeDrawSettings = settings;
}
