import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SprinkleBrushCursor } from '@/tools/sprinkle/overlay/sprinkle_brush_cursor.js';
import { getStateSprinkleTool } from '@/tools/sprinkle/state_sprinkle_tool.js';

const cursorsToDispose: SprinkleBrushCursor[] = [];

/**
 * Creates a cursor that is disposed after the test.
 *
 * @returns New cursor.
 */
function cursorTestCreate(): SprinkleBrushCursor {
  const cursor = new SprinkleBrushCursor();
  cursorsToDispose.push(cursor);
  return cursor;
}

/**
 * Builds a world surface point away from the world axes.
 *
 * @returns Hit point.
 */
function cursorTestPoint(): THREE.Vector3 {
  return new THREE.Vector3(3.5, -1.25, 7);
}

/** Hammer-style sprinkle radius cursor. */
describe('SprinkleBrushCursor', () => {
  afterEach(() => {
    cursorsToDispose.splice(0).forEach((cursor) => cursor.dispose());
    getStateSprinkleTool().reset();
  });

  it('starts hidden and is an editor-only helper', () => {
    const cursor = cursorTestCreate();
    expect(cursor.isVisible()).toBe(false);
    expect(cursor.root.userData['isSprinkleOverlayHelper']).toBe(true);
    expect(cursor.sphere.userData['isSprinkleOverlayHelper']).toBe(true);
  });

  it('never reports raycast hits so it cannot be scattered onto', () => {
    const cursor = cursorTestCreate();
    const raycaster = new THREE.Raycaster();
    raycaster.set(cursorTestPoint(), new THREE.Vector3(0, 1, 0));
    const hits = raycaster.intersectObject(cursor.sphere, true);
    expect(hits).toHaveLength(0);
  });

  it('sizes the sphere to the sprinkle radius at the hovered point', () => {
    const cursor = cursorTestCreate();
    const point = cursorTestPoint();
    const radius = getStateSprinkleTool().configRead().radius;
    cursor.showAt(point, radius);
    expect(cursor.isVisible()).toBe(true);
    expect(cursor.root.position.distanceTo(point)).toBeLessThan(1e-9);
    expect(cursor.sphere.scale.x).toBeCloseTo(radius, 9);
    expect(cursor.sphere.scale.y).toBeCloseTo(radius, 9);
    expect(cursor.sphere.scale.z).toBeCloseTo(radius, 9);
  });

  it('follows radius changes from the sprinkle configuration', () => {
    const cursor = cursorTestCreate();
    const point = cursorTestPoint();
    cursor.showAt(point, 0.5);
    expect(cursor.sphere.scale.x).toBeCloseTo(0.5, 9);
    getStateSprinkleTool().configPatch({ radius: 2.75 });
    cursor.showAt(point, getStateSprinkleTool().configRead().radius);
    expect(cursor.sphere.scale.x).toBeCloseTo(2.75, 9);
  });

  it('hides on request', () => {
    const cursor = cursorTestCreate();
    cursor.showAt(cursorTestPoint(), 1);
    expect(cursor.isVisible()).toBe(true);
    cursor.hide();
    expect(cursor.isVisible()).toBe(false);
  });
});
