import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  StateDisplacementSculpt,
  type DisplacementSculptSettings,
} from '@/displacement/state/state_displacement_sculpt.js';
import type { DisplacementSurfaceHit } from '@/displacement/sculpt/displacement_surface_raycaster.js';
import { DisplacementBrushCursor } from '@/displacement/overlay/displacement_brush_cursor.js';
import { displacementOverlayHelperIs } from '@/displacement/overlay/displacement_overlay_helper_flags.js';
import { displacementSculptModifiersSettingsApply } from '@/displacement/sculpt/displacement_sculpt_modifiers.js';

const cursorsToDispose: DisplacementBrushCursor[] = [];

/**
 * Creates a cursor that is disposed after the test.
 *
 * @returns New cursor.
 */
function cursorTestCreate(): DisplacementBrushCursor {
  const cursor = new DisplacementBrushCursor();
  cursorsToDispose.push(cursor);
  return cursor;
}

/**
 * Builds default Displacement tab settings with some fields replaced.
 *
 * @param overrides Settings to replace.
 * @returns Settings.
 */
function cursorTestSettings(overrides: Partial<DisplacementSculptSettings>): DisplacementSculptSettings {
  return { ...new StateDisplacementSculpt().settingsRead(), activeTool: 'paint_geometry', ...overrides };
}

/**
 * Builds a surface hit with a tilted normal away from the world axes.
 *
 * @returns Hit point and unit normal.
 */
function cursorTestHit(): DisplacementSurfaceHit {
  return { point: new THREE.Vector3(3.5, -1.25, 7), normal: new THREE.Vector3(1, 2, -0.5).normalize() };
}

/**
 * Returns the world position of the arrow tip.
 *
 * @param cursor Cursor whose arrow is read.
 * @returns Arrow tip in world space.
 */
function cursorTestArrowTipRead(cursor: DisplacementBrushCursor): THREE.Vector3 {
  cursor.root.updateMatrixWorld(true);
  return cursor.arrow.localToWorld(new THREE.Vector3(0, cursor.arrow.cone.position.y, 0));
}

/** Hammer-style displacement paint cursor. */
describe('DisplacementBrushCursor', () => {
  afterEach(() => {
    cursorsToDispose.splice(0).forEach((cursor) => cursor.dispose());
  });

  it('starts hidden and is an editor-only helper', () => {
    const cursor = cursorTestCreate();
    expect(cursor.isVisible()).toBe(false);
    expect(displacementOverlayHelperIs(cursor.root)).toBe(true);
    expect(displacementOverlayHelperIs(cursor.sphere)).toBe(true);
  });

  it('sizes the sphere to the radius and the arrow to the distance along the face normal', () => {
    const cursor = cursorTestCreate();
    const hit = cursorTestHit();
    const settings = cursorTestSettings({ radius: 2.75, distance: 0.6, axis: 'face_normal', raise: true });
    cursor.showAt(hit, settings);
    expect(cursor.isVisible()).toBe(true);
    expect(cursor.root.position.distanceTo(hit.point)).toBeLessThan(1e-9);
    expect(cursor.sphere.scale.x).toBeCloseTo(settings.radius, 9);
    expect(cursor.sphere.scale.y).toBeCloseTo(settings.radius, 9);
    expect(cursor.arrow.visible).toBe(true);
    const shaft = cursorTestArrowTipRead(cursor).sub(hit.point);
    expect(shaft.length()).toBeCloseTo(settings.distance, 6);
    expect(shaft.normalize().dot(hit.normal)).toBeCloseTo(1, 6);
  });

  it.each([
    ['x', new THREE.Vector3(1, 0, 0)],
    ['y', new THREE.Vector3(0, 1, 0)],
    ['z', new THREE.Vector3(0, 0, 1)],
  ] as const)('points the arrow along world %s for that paint axis', (axis, expected) => {
    const cursor = cursorTestCreate();
    const hit = cursorTestHit();
    cursor.showAt(hit, cursorTestSettings({ axis, distance: 1.5, raise: true }));
    const shaft = cursorTestArrowTipRead(cursor).sub(hit.point);
    expect(shaft.length()).toBeCloseTo(1.5, 6);
    expect(shaft.normalize().dot(expected)).toBeCloseTo(1, 6);
  });

  it('flips the arrow when Ctrl or the right button inverts raise and when raise is off', () => {
    const cursor = cursorTestCreate();
    const hit = cursorTestHit();
    const cases: Array<{ raise: boolean; ctrl: boolean; secondary: boolean; sign: number }> = [
      { raise: true, ctrl: false, secondary: false, sign: 1 },
      { raise: true, ctrl: true, secondary: false, sign: -1 },
      { raise: true, ctrl: false, secondary: true, sign: -1 },
      { raise: true, ctrl: true, secondary: true, sign: 1 },
      { raise: false, ctrl: false, secondary: false, sign: -1 },
      { raise: false, ctrl: true, secondary: false, sign: 1 },
    ];
    cases.forEach(({ raise, ctrl, secondary, sign }) => {
      const modifiers = { isCtrlDown: ctrl, isShiftDown: false, isSecondaryButton: secondary };
      cursor.showAt(
        hit,
        displacementSculptModifiersSettingsApply(cursorTestSettings({ raise, distance: 0.4 }), modifiers),
      );
      const direction = cursorTestArrowTipRead(cursor).sub(hit.point).normalize();
      expect(direction.dot(hit.normal)).toBeCloseTo(sign, 6);
    });
  });

  it('hides the arrow while Shift turns Paint Geometry into Smooth', () => {
    const cursor = cursorTestCreate();
    const settings = cursorTestSettings({ effect: 'raise_lower', distance: 0.4, radius: 1.7 });
    const modifiers = { isCtrlDown: false, isShiftDown: true, isSecondaryButton: false };
    cursor.showAt(cursorTestHit(), displacementSculptModifiersSettingsApply(settings, modifiers));
    expect(cursor.isVisible()).toBe(true);
    expect(cursor.sphere.scale.x).toBeCloseTo(settings.radius, 9);
    expect(cursor.arrow.visible).toBe(false);
  });

  it('shows only the sphere for Paint Alpha and hides on request', () => {
    const cursor = cursorTestCreate();
    cursor.showAt(cursorTestHit(), cursorTestSettings({ activeTool: 'paint_alpha', radius: 0.8 }));
    expect(cursor.isVisible()).toBe(true);
    expect(cursor.sphere.scale.x).toBeCloseTo(0.8, 9);
    expect(cursor.arrow.visible).toBe(false);
    cursor.hide();
    expect(cursor.isVisible()).toBe(false);
  });
});
