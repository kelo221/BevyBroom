import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BRUSH_RESIZE_PIXELS_PER_DOUBLING } from '@/tools/brush_resize/brush_resize_radius.js';
import { SprinkleMark } from '@/tools/sprinkle/mark/sprinkle_mark.js';
import { RouterSprinklePointer } from '@/tools/sprinkle/pointer/router_sprinkle_pointer.js';
import { getStateSprinkleTool } from '@/tools/sprinkle/state_sprinkle_tool.js';
import { SPRINKLE_RADIUS_MAX } from '@/tools/sprinkle/sprinkle_types.js';
import {
  SPRINKLE_TEST_DEFINITION_NAME,
  sprinkleTestLibraryInstall,
  sprinkleTestSceneCreate,
  sprinkleTestViewCreate,
  type SprinkleTestScene,
  type SprinkleTestView,
} from '../sprinkle_test_support.js';

/** Center of the floor's top face in the router tests. */
const ROUTER_TEST_FLOOR_CENTER = new THREE.Vector3(-4.6, 0.75, 6.1);

/** Router, scene, view and the Ctrl key of one test. */
interface RouterTestParts {
  router: RouterSprinklePointer;
  scene: SprinkleTestScene;
  view: SprinkleTestView;
  keys: { ctrl: boolean };
}

/**
 * Builds a router over a floor seen from above with the Sprinkle tool active
 * and the test definition chosen.
 *
 * @returns Test parts.
 */
function routerTestPartsCreate(): RouterTestParts {
  const scene = sprinkleTestSceneCreate(ROUTER_TEST_FLOOR_CENTER, 40);
  const view = sprinkleTestViewCreate(ROUTER_TEST_FLOOR_CENTER, new THREE.Vector3(0, 1, 0), 10);
  const keys = { ctrl: false };
  const router = new RouterSprinklePointer({ ...scene.services, isCtrlDown: () => keys.ctrl });
  getStateSprinkleTool().toolActiveWrite(true);
  getStateSprinkleTool().configPatch({ definitionName: SPRINKLE_TEST_DEFINITION_NAME, densityPercent: 100, radius: 2 });
  return { router, scene, view, keys };
}

/**
 * Builds a pointer event at the view center shifted horizontally.
 *
 * @param view Fake viewport.
 * @param shiftX Horizontal shift in pixels.
 * @returns Pointer event.
 */
function routerTestEvent(view: SprinkleTestView, shiftX: number = 0): MouseEvent {
  return new MouseEvent('pointermove', { clientX: view.centerClientX + shiftX, clientY: view.centerClientY });
}

/**
 * Presses, drags and releases a button over the view center.
 *
 * @param parts Test parts.
 * @param pressButton Mouse button of the press.
 * @param dragShiftX Horizontal travel of the drag in pixels.
 * @returns Whether the press was taken.
 */
function routerTestPressDragRelease(
  parts: RouterTestParts,
  pressButton: 'primary' | 'secondary',
  dragShiftX: number,
): boolean {
  const { router, view } = parts;
  const taken = router.strokeTryBegin(routerTestEvent(view), view.camera, view.pickElement, pressButton);
  router.strokeContinue(routerTestEvent(view, dragShiftX), view.camera, view.pickElement);
  router.strokeEnd();
  return taken;
}

/** Viewport presses routed to Sprinkle strokes and brush resizing. */
describe('RouterSprinklePointer', () => {
  let parts: RouterTestParts;
  let uninstall: () => void = () => undefined;

  beforeEach(() => {
    uninstall = sprinkleTestLibraryInstall();
    parts = routerTestPartsCreate();
  });

  afterEach(() => {
    parts.router.dispose();
    getStateSprinkleTool().reset();
    uninstall();
  });

  it('paints a stroke from press to release as one undo step', () => {
    expect(routerTestPressDragRelease(parts, 'primary', 20)).toBe(true);
    expect(SprinkleMark.objectsCollect(parts.scene.world).length).toBeGreaterThan(0);
    expect(parts.scene.commandStack.getUndoCount()).toBe(1);
    parts.scene.commandStack.undo();
    expect(SprinkleMark.objectsCollect(parts.scene.world)).toEqual([]);
  });

  it('erases with Ctrl held at the press', () => {
    routerTestPressDragRelease(parts, 'primary', 0);
    const painted = SprinkleMark.objectsCollect(parts.scene.world).length;
    parts.keys.ctrl = true;
    expect(parts.router.isSubtractiveShown()).toBe(true);
    routerTestPressDragRelease(parts, 'primary', 0);
    expect(painted).toBeGreaterThan(0);
    expect(SprinkleMark.objectsCollect(parts.scene.world)).toEqual([]);
  });

  it('resizes the brush with the right button and keeps the cursor at the press point', () => {
    const { router, view } = parts;
    const startRadius = getStateSprinkleTool().configRead().radius;
    expect(router.strokeTryBegin(routerTestEvent(view), view.camera, view.pickElement, 'secondary')).toBe(true);
    const anchor = router.resizeAnchorRead()?.clone();
    router.strokeContinue(routerTestEvent(view, BRUSH_RESIZE_PIXELS_PER_DOUBLING), view.camera, view.pickElement);
    expect(getStateSprinkleTool().configRead().radius).toBeCloseTo(startRadius * 2, 9);
    expect(anchor?.distanceTo(ROUTER_TEST_FLOOR_CENTER)).toBeLessThan(1e-6);
    router.strokeEnd();
    expect(router.resizeAnchorRead()).toBeNull();
    expect(SprinkleMark.objectsCollect(parts.scene.world)).toEqual([]);
    expect(parts.scene.commandStack.canUndo()).toBe(false);
  });

  it('clamps resizing to the largest Sprinkle radius', () => {
    routerTestPressDragRelease(parts, 'secondary', BRUSH_RESIZE_PIXELS_PER_DOUBLING * 100);
    expect(getStateSprinkleTool().configRead().radius).toBe(SPRINKLE_RADIUS_MAX);
  });

  it('takes no press while the Sprinkle tool is inactive or off every surface', () => {
    const { router, view } = parts;
    const awayFromFloor = new MouseEvent('pointerdown', { clientX: view.centerClientX, clientY: -500 });
    expect(router.strokeTryBegin(awayFromFloor, view.camera, view.pickElement)).toBe(false);
    getStateSprinkleTool().toolActiveWrite(false);
    expect(router.strokeTryBegin(routerTestEvent(view), view.camera, view.pickElement)).toBe(false);
  });

  it('holds a press without a chosen type and reports it', () => {
    getStateSprinkleTool().configPatch({ definitionName: null });
    const { router, view } = parts;
    expect(router.strokeTryBegin(routerTestEvent(view), view.camera, view.pickElement)).toBe(true);
    expect(router.isPressActive()).toBe(true);
    expect(parts.scene.statusMessages).toHaveLength(1);
    expect(router.strokeEnd()).toEqual({ added: 0, removed: 0 });
  });
});
