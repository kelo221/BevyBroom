import { afterEach, describe, expect, it } from 'vitest';
import { ViewportToolPolygonSprinkleControls } from '@/tools/chrome/options/viewport_tool_polygon_sprinkle_controls.js';
import { getStateSprinkleTool } from '@/tools/sprinkle/state_sprinkle_tool.js';
import { SPRINKLE_RADIUS_MAX, SPRINKLE_RADIUS_MIN } from '@/tools/sprinkle/sprinkle_types.js';
import { sprinkleRadiusScaleByDoublings } from '@/tools/sprinkle/radius/sprinkle_radius_scale.js';
import { SPRINKLE_RADIUS_WHEEL_NOTCH_DOUBLINGS } from '@/tools/sprinkle/radius/sprinkle_radius_wheel_consumer.js';

/** Controls built by the running test. */
let polygonSprinkleControlsTest: ViewportToolPolygonSprinkleControls | null = null;

/**
 * Creates the controls and returns the Sprinkle radius field.
 *
 * @returns Radius input of the Sprinkle strip.
 */
function sprinkleRadiusInputCreate(): HTMLInputElement {
  polygonSprinkleControlsTest = new ViewportToolPolygonSprinkleControls(document);
  const radiusInput = polygonSprinkleControlsTest
    .sprinkleElementRead()
    .querySelector<HTMLInputElement>('[aria-label="Sprinkle radius"]');
  if (!radiusInput) throw new Error('radius input missing');
  return radiusInput;
}

/**
 * Types a radius and commits it.
 *
 * @param radiusInput Radius input.
 * @param value Typed value.
 */
function sprinkleRadiusCommit(radiusInput: HTMLInputElement, value: string): void {
  radiusInput.value = value;
  radiusInput.dispatchEvent(new Event('change'));
}

afterEach(() => {
  polygonSprinkleControlsTest?.dispose();
  polygonSprinkleControlsTest = null;
  getStateSprinkleTool().reset();
});

/** Sprinkle strip of the tool options bar. */
describe('ViewportToolPolygonSprinkleControls sprinkle strip', () => {
  it('holds only the radius field and leaves mode and density to the Entity Sprinkle window', () => {
    sprinkleRadiusInputCreate();
    const strip = polygonSprinkleControlsTest?.sprinkleElementRead();
    expect(strip?.querySelectorAll('input')).toHaveLength(1);
    expect(strip?.querySelector('select')).toBeNull();
  });

  it('shows the stored radius and follows radius changes made elsewhere', () => {
    const radiusInput = sprinkleRadiusInputCreate();
    expect(Number(radiusInput.value)).toBe(getStateSprinkleTool().configRead().radius);
    const changedRadius = (SPRINKLE_RADIUS_MIN + SPRINKLE_RADIUS_MAX) / 2;
    getStateSprinkleTool().configPatch({ radius: changedRadius });
    expect(Number(radiusInput.value)).toBe(changedRadius);
  });

  it('follows wheel and shortcut radius steps at once, showing at most three decimals', () => {
    const radiusInput = sprinkleRadiusInputCreate();
    getStateSprinkleTool().toolActiveWrite(true);
    sprinkleRadiusScaleByDoublings(SPRINKLE_RADIUS_WHEEL_NOTCH_DOUBLINGS);
    const steppedRadius = getStateSprinkleTool().configRead().radius;
    expect(Number(radiusInput.value)).toBeCloseTo(steppedRadius, 3);
    expect(radiusInput.value.split('.')[1]?.length ?? 0).toBeLessThanOrEqual(3);
  });

  it('stores typed radii clamped to the Sprinkle radius range and ignores text', () => {
    const radiusInput = sprinkleRadiusInputCreate();
    const typedRadius = SPRINKLE_RADIUS_MIN * 3;
    sprinkleRadiusCommit(radiusInput, String(typedRadius));
    expect(getStateSprinkleTool().configRead().radius).toBe(typedRadius);
    sprinkleRadiusCommit(radiusInput, String(SPRINKLE_RADIUS_MAX * 2));
    expect(getStateSprinkleTool().configRead().radius).toBe(SPRINKLE_RADIUS_MAX);
    sprinkleRadiusCommit(radiusInput, String(-SPRINKLE_RADIUS_MAX));
    expect(getStateSprinkleTool().configRead().radius).toBe(SPRINKLE_RADIUS_MIN);
    sprinkleRadiusCommit(radiusInput, 'wide');
    expect(getStateSprinkleTool().configRead().radius).toBe(SPRINKLE_RADIUS_MIN);
    expect(Number(radiusInput.value)).toBe(SPRINKLE_RADIUS_MIN);
  });
});
