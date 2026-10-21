import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  SHAPE_DRAW_AXES,
  shapeDrawAxesOtherThan,
  shapeDrawBoxFromFootprint,
  shapeDrawBoxFromViewRectangle,
  shapeDrawBoxHasVolume,
  shapeDrawCornerEqualize,
  shapeDrawDominantAxis,
  shapeDrawRangeSnapOutward,
  type ShapeDrawFootprintRequest,
} from '@/tools/shape_draw/shape_draw_bounds_math.js';

/**
 * Returns whether a value lies on a grid line.
 *
 * @param value Coordinate to test.
 * @param gridStep Grid step length.
 * @returns True when the value is a whole number of grid steps.
 */
function isOnGridLine(value: number, gridStep: number): boolean {
  const steps = value / gridStep;
  return Math.abs(steps - Math.round(steps)) < 1e-9;
}

/**
 * Builds a footprint request with snapping on and no height, overriding fields.
 *
 * @param overrides Fields that differ from the defaults.
 * @returns Complete footprint request.
 */
function footprintRequest(overrides: Partial<ShapeDrawFootprintRequest>): ShapeDrawFootprintRequest {
  return {
    startLocal: new THREE.Vector3(),
    cornerLocal: new THREE.Vector3(),
    heightLocal: null,
    squareFootprint: false,
    gridStep: 0.5,
    snapEnabled: true,
    growDirectionLocal: new THREE.Vector3(0, 1, 0),
    ...overrides,
  };
}

/**
 * Proves the pure box math of drawn brushes: outward snapping, square
 * footprints, flat-axis growth and the 2D view rectangle with reference depth.
 */
describe('shape draw bounds math', () => {
  const gridStep = 0.5;

  it('snaps a range outward so it always encloses the dragged range', () => {
    const minimum = 0.3;
    const maximum = 1.1;
    const snapped = shapeDrawRangeSnapOutward(minimum, maximum, gridStep);
    expect(snapped.minimum).toBeLessThanOrEqual(minimum);
    expect(snapped.maximum).toBeGreaterThanOrEqual(maximum);
    expect(snapped.maximum - snapped.minimum).toBeLessThan(maximum - minimum + 2 * gridStep);
    expect(isOnGridLine(snapped.minimum, gridStep) && isOnGridLine(snapped.maximum, gridStep)).toBe(true);
  });

  it('keeps values already on grid lines despite floating point noise', () => {
    const onGrid = 3 * gridStep;
    const snapped = shapeDrawRangeSnapOutward(onGrid + 1e-12, onGrid * 2 - 1e-12, gridStep);
    expect(snapped.minimum).toBeCloseTo(onGrid, 9);
    expect(snapped.maximum).toBeCloseTo(onGrid * 2, 9);
  });

  it('equalizes a corner to the longer side while keeping each drag direction', () => {
    const start = new THREE.Vector3(1, 2, 3);
    const corner = start.clone().add(new THREE.Vector3(-0.4, 5, 1.7));
    const equalized = shapeDrawCornerEqualize(start, corner, 'x', 'z');
    const offset = equalized.clone().sub(start);
    expect(Math.abs(offset.x)).toBeCloseTo(Math.abs(offset.z), 9);
    expect(Math.abs(offset.z)).toBeCloseTo(1.7, 9);
    expect(Math.sign(offset.x)).toBe(-1);
    expect(equalized.y).toBe(corner.y);
  });

  it('builds a flat footprint one grid step tall, growing toward the grow direction', () => {
    const start = new THREE.Vector3(0.2, 1.5, 0.3);
    const corner = start.clone().add(new THREE.Vector3(1.6, 0, -0.9));
    const grownUp = shapeDrawBoxFromFootprint(footprintRequest({ startLocal: start, cornerLocal: corner, gridStep }));
    expect(grownUp.min.y).toBeCloseTo(start.y, 9);
    expect(grownUp.max.y).toBeCloseTo(start.y + gridStep, 9);
    const grownDown = shapeDrawBoxFromFootprint(
      footprintRequest({
        startLocal: start,
        cornerLocal: corner,
        gridStep,
        growDirectionLocal: new THREE.Vector3(0, -1, 0),
      }),
    );
    expect(grownDown.max.y).toBeCloseTo(start.y, 9);
    expect(grownDown.min.y).toBeCloseTo(start.y - gridStep, 9);
  });

  it('snaps every footprint face outward onto grid lines and contains the drag', () => {
    const start = new THREE.Vector3(0.2, 0.1, 0.3);
    const corner = start.clone().add(new THREE.Vector3(1.6, 0, -0.9));
    const box = shapeDrawBoxFromFootprint(
      footprintRequest({ startLocal: start, cornerLocal: corner, gridStep, heightLocal: 1.3 }),
    );
    for (const axis of SHAPE_DRAW_AXES) {
      expect(isOnGridLine(box.min[axis], gridStep) && isOnGridLine(box.max[axis], gridStep)).toBe(true);
    }
    expect(box.containsPoint(start) && box.containsPoint(new THREE.Vector3(corner.x, 1.3, corner.z))).toBe(true);
  });

  it('keeps the dragged footprint unchanged when snapping is off', () => {
    const start = new THREE.Vector3(0.2, 0.1, 0.3);
    const corner = start.clone().add(new THREE.Vector3(1.6, 0, -0.9));
    const height = 0.77;
    const box = shapeDrawBoxFromFootprint(
      footprintRequest({ startLocal: start, cornerLocal: corner, gridStep, heightLocal: height, snapEnabled: false }),
    );
    expect(box.min.toArray()).toEqual([start.x, start.y, corner.z]);
    expect(box.max.toArray()).toEqual([corner.x, height, start.z]);
  });

  it('forces a square footprint when requested', () => {
    const start = new THREE.Vector3(0, 0, 0);
    const corner = new THREE.Vector3(3 * gridStep, 0, -gridStep);
    const box = shapeDrawBoxFromFootprint(
      footprintRequest({ startLocal: start, cornerLocal: corner, gridStep, squareFootprint: true }),
    );
    const size = box.getSize(new THREE.Vector3());
    expect(size.x).toBeCloseTo(size.z, 9);
    expect(size.x).toBeCloseTo(3 * gridStep, 9);
  });

  it('takes the 2D depth from the request and snaps only the visible rectangle', () => {
    const depthMin = 0.13;
    const depthMax = 1.37;
    const start = new THREE.Vector3(0.2, 0.3, 9);
    const corner = new THREE.Vector3(1.1, 1.6, -4);
    const box = shapeDrawBoxFromViewRectangle({
      startLocal: start,
      cornerLocal: corner,
      depthAxis: 'z',
      depthMin,
      depthMax,
      equalSides: false,
      gridStep,
      snapEnabled: true,
    });
    expect(box.min.z).toBe(depthMin);
    expect(box.max.z).toBe(depthMax);
    for (const axis of shapeDrawAxesOtherThan('z')) {
      expect(isOnGridLine(box.min[axis], gridStep) && isOnGridLine(box.max[axis], gridStep)).toBe(true);
    }
  });

  it('gives a 2D rectangle equal visible sides when requested', () => {
    const box = shapeDrawBoxFromViewRectangle({
      startLocal: new THREE.Vector3(0, 0, 0),
      cornerLocal: new THREE.Vector3(0, 2 * gridStep, 5 * gridStep),
      depthAxis: 'x',
      depthMin: -1,
      depthMax: 1,
      equalSides: true,
      gridStep,
      snapEnabled: false,
    });
    const size = box.getSize(new THREE.Vector3());
    expect(size.y).toBeCloseTo(size.z, 9);
  });

  it('picks the dominant axis and reports volume only for solid boxes', () => {
    expect(shapeDrawDominantAxis(new THREE.Vector3(0.1, -0.9, 0.3))).toBe('y');
    expect(shapeDrawDominantAxis(new THREE.Vector3(0.1, 0.2, -0.7))).toBe('z');
    expect(shapeDrawAxesOtherThan('y')).toEqual(['x', 'z']);
    const flat = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 1));
    expect(shapeDrawBoxHasVolume(flat)).toBe(false);
    expect(shapeDrawBoxHasVolume(new THREE.Box3())).toBe(false);
    expect(shapeDrawBoxHasVolume(new THREE.Box3(new THREE.Vector3(), new THREE.Vector3(1, 1, 1)))).toBe(true);
  });
});
