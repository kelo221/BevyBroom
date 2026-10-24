import { describe, expect, it } from 'vitest';
import {
  ShapeDrawSettings,
  getShapeDrawSettings,
  setShapeDrawSettingsForTests,
} from '@/tools/shape_draw/shapes/shape_draw_settings.js';

/** Proves shape settings hold the selection, per-shape values and listeners. */
describe('ShapeDrawSettings', () => {
  it('starts on the cuboid with no stored values', () => {
    const settings = new ShapeDrawSettings();
    expect(settings.getSelectedShapeId()).toBe('cuboid');
    expect(settings.parameterValuesRead('stairs')).toEqual({});
  });

  it('notifies listeners when the selected shape changes', () => {
    const settings = new ShapeDrawSettings();
    let changes = 0;
    settings.changeListenerAdd(() => {
      changes += 1;
    });
    settings.shapeSelect('stairs');
    expect(settings.getSelectedShapeId()).toBe('stairs');
    expect(changes).toBe(1);
    settings.shapeSelect('stairs');
    expect(changes).toBe(1);
  });

  it('stores per-shape parameter values and notifies listeners', () => {
    const settings = new ShapeDrawSettings();
    let changes = 0;
    settings.changeListenerAdd(() => {
      changes += 1;
    });
    settings.parameterSet('stairs', 'stepHeight', 0.75);
    settings.parameterSet('cylinder', 'sides', 12);
    expect(settings.parameterValuesRead('stairs')).toEqual({ stepHeight: 0.75 });
    expect(settings.parameterValuesRead('cylinder')).toEqual({ sides: 12 });
    expect(changes).toBe(2);
    settings.parameterSet('stairs', 'stepHeight', 0.75);
    expect(changes).toBe(2);
  });

  it('lists parameter states with defaults for untouched values', () => {
    const settings = new ShapeDrawSettings();
    settings.parameterSet('stairs', 'direction', '-x');
    const states = settings.parameterStatesList('stairs');
    expect(states.map((state) => state.parameter.id)).toEqual(['stepHeight', 'direction']);
    expect(states[0]?.value).toBe(0.5);
    expect(states[1]?.value).toBe('-x');
  });

  it('stops notifying a removed listener and resets to defaults', () => {
    const settings = new ShapeDrawSettings();
    let changes = 0;
    const listener = () => {
      changes += 1;
    };
    settings.changeListenerAdd(listener);
    settings.shapeSelect('arch');
    settings.changeListenerRemove(listener);
    settings.shapeSelect('cone');
    expect(changes).toBe(1);
    settings.reset();
    expect(settings.getSelectedShapeId()).toBe('cuboid');
  });

  it('shares one process-wide instance that tests can replace', () => {
    expect(getShapeDrawSettings()).toBe(getShapeDrawSettings());
    const replacement = new ShapeDrawSettings();
    setShapeDrawSettingsForTests(replacement);
    expect(getShapeDrawSettings()).toBe(replacement);
    setShapeDrawSettingsForTests(null);
    expect(getShapeDrawSettings()).not.toBe(replacement);
  });
});
