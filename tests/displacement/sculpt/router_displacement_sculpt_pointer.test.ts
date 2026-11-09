import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { findFirstTriangleForBrushSurface } from '@/selection/face/solid_triangle_source_index.js';
import type { FaceSelection } from '@/selection/face/manager_face_selection.js';
import { getStateFaceEditSession } from '@/texture/paint/state_face_edit_session.js';
import {
  DISPLACEMENT_SCULPT_RADIUS_MIN,
  getStateDisplacementSculpt,
} from '@/displacement/state/state_displacement_sculpt.js';
import { getStateDisplacementSculptPress } from '@/displacement/state/state_displacement_sculpt_press.js';
import { BRUSH_RESIZE_PIXELS_PER_DOUBLING } from '@/tools/brush_resize/brush_resize_radius.js';
import { RouterDisplacementSculptPointer } from '@/displacement/sculpt/router_displacement_sculpt_pointer.js';
import type { SolidFaceTextureTarget } from '@/texture/commands/command_texture_solid_face_edit.js';
import {
  displacementTestAlphasRead,
  displacementTestBoxAdd,
  displacementTestCreate,
  displacementTestFaceCenter,
  displacementTestFaceFacing,
  displacementTestOffsetsRead,
  displacementTestRigCreate,
  displacementTestTarget,
  type DisplacementTestRig,
} from '../displacement_test_rig.js';
import { DisplacementSculptFrameSchedulerFake } from './displacement_sculpt_frame_scheduler_fake.js';
import { displacementPickTestViewCreate, type DisplacementPickTestView } from '../displacement_pick_test_view.js';

/** Router, rig, displaced face and a view aimed at the face center. */
interface RouterTestParts {
  rig: DisplacementTestRig;
  target: SolidFaceTextureTarget;
  router: RouterDisplacementSculptPointer;
  view: DisplacementPickTestView;
  keys: { ctrl: boolean; shift: boolean };
  scheduler: DisplacementSculptFrameSchedulerFake;
}

/**
 * Builds a displaced top face, a router whose face selection is that face and a
 * view whose centered pointer hits the face center.
 *
 * @returns Test parts.
 */
function routerTestPartsCreate(): RouterTestParts {
  const rig = displacementTestRigCreate('RouterSculpt');
  const brush = displacementTestBoxAdd(rig, new THREE.Vector3(4, 1, 4), new THREE.Vector3(-3, 2, 1));
  const target = displacementTestTarget(rig, brush, displacementTestFaceFacing(brush, new THREE.Vector3(0, 1, 0)));
  displacementTestCreate(rig, target, 3);
  const keys = { ctrl: false, shift: false };
  const scheduler = new DisplacementSculptFrameSchedulerFake();
  const router = new RouterDisplacementSculptPointer({
    commandStack: rig.commandStack,
    selectedFacesRead: () => routerTestSelectionBuild(rig, target),
    isCtrlDown: () => keys.ctrl,
    isShiftDown: () => keys.shift,
    afterDab: () => undefined,
    frameScheduler: scheduler,
  });
  const view = displacementPickTestViewCreate(displacementTestFaceCenter(target), new THREE.Vector3(0, 1, 0), 8);
  return { rig, target, router, view, keys, scheduler };
}

/**
 * Builds a face selection holding one result triangle of a face.
 *
 * @param rig Test rig.
 * @param target Selected face.
 * @returns Face selection list.
 */
function routerTestSelectionBuild(rig: DisplacementTestRig, target: SolidFaceTextureTarget): FaceSelection[] {
  const resultMesh = rig.model.getResultMesh();
  return [
    { mesh: resultMesh, faceIndex: findFirstTriangleForBrushSurface(resultMesh, target.brushId, target.surfaceIndex) },
  ];
}

/**
 * Builds a pointer move shifted horizontally from a view's press point.
 *
 * @param view View whose centered press the move starts from.
 * @param travelPx Horizontal travel in pixels; negative moves left.
 * @returns Pointer move event.
 */
function routerTestMovedEvent(view: DisplacementPickTestView, travelPx: number): MouseEvent {
  return new MouseEvent('pointermove', { clientX: view.event.clientX + travelPx, clientY: view.event.clientY });
}

/** Turns on the Displacement tab and the Paint Geometry tool. */
function routerTestRoutingEnable(): void {
  getStateFaceEditSession().sheetOpenWrite(true);
  getStateFaceEditSession().activeTabIdWrite('displacement');
  getStateDisplacementSculpt().settingsWrite({
    activeTool: 'paint_geometry',
    effect: 'raise_lower',
    raise: true,
    radius: 1,
    distance: 0.2,
  });
}

/** Viewport sculpt routing for displaced faces. */
describe('RouterDisplacementSculptPointer', () => {
  afterEach(() => {
    getStateFaceEditSession().reset();
    getStateDisplacementSculpt().reset();
  });

  it('ignores presses while the Displacement tab or Paint Geometry is off', () => {
    const { target, router, view } = routerTestPartsCreate();
    const before = displacementTestOffsetsRead(target);
    expect(router.isRoutingActive()).toBe(false);
    expect(router.strokeTryBegin(view.event, view.camera, view.pickElement)).toBe(false);
    getStateFaceEditSession().sheetOpenWrite(true);
    getStateFaceEditSession().activeTabIdWrite('displacement');
    expect(router.strokeTryBegin(view.event, view.camera, view.pickElement)).toBe(false);
    expect(displacementTestOffsetsRead(target)).toEqual(before);
  });

  it('raises the selected face under the pointer and records one undo step per stroke', () => {
    const { rig, target, router, view } = routerTestPartsCreate();
    routerTestRoutingEnable();
    const undoCountBefore = rig.commandStack.getUndoCount();
    expect(router.strokeTryBegin(view.event, view.camera, view.pickElement)).toBe(true);
    expect(router.isStrokeActive()).toBe(true);
    expect(router.strokeContinue(view.event, view.camera, view.pickElement)).toBe(true);
    expect(router.strokeEnd()).toBe(2);
    expect(router.isStrokeActive()).toBe(false);
    expect(rig.commandStack.getUndoCount()).toBe(undoCountBefore + 1);
    expect(Math.max(...displacementTestOffsetsRead(target))).toBeGreaterThan(0.2);
    expect(Math.min(...displacementTestOffsetsRead(target))).toBe(0);
  });

  it('lowers instead of raising while Ctrl is held', () => {
    const { target, router, view, keys } = routerTestPartsCreate();
    routerTestRoutingEnable();
    keys.ctrl = true;
    expect(router.strokeTryBegin(view.event, view.camera, view.pickElement)).toBe(true);
    router.strokeEnd();
    expect(Math.min(...displacementTestOffsetsRead(target))).toBeLessThan(0);
  });

  it('lowers instead of raising with the right button and raises again with Ctrl + right', () => {
    const { target, router, view, keys } = routerTestPartsCreate();
    routerTestRoutingEnable();
    expect(router.strokeTryBegin(view.event, view.camera, view.pickElement, 'secondary')).toBe(true);
    router.strokeEnd();
    const loweredMinimum = Math.min(...displacementTestOffsetsRead(target));
    expect(loweredMinimum).toBeLessThan(0);
    expect(Math.max(...displacementTestOffsetsRead(target))).toBe(0);
    keys.ctrl = true;
    expect(router.strokeTryBegin(view.event, view.camera, view.pickElement, 'secondary')).toBe(true);
    router.strokeEnd();
    expect(Math.min(...displacementTestOffsetsRead(target))).toBeGreaterThan(loweredMinimum);
  });

  it('smooths a raised bump instead of raising it while Shift is held with Paint Geometry', () => {
    const { target, router, view, keys } = routerTestPartsCreate();
    routerTestRoutingEnable();
    getStateDisplacementSculpt().settingsWrite({ edge: 'hard', radius: 0.5 });
    router.strokeTryBegin(view.event, view.camera, view.pickElement);
    router.strokeEnd();
    const bumpPeak = Math.max(...displacementTestOffsetsRead(target));
    expect(bumpPeak).toBeGreaterThan(0);
    keys.shift = true;
    getStateDisplacementSculpt().settingsWrite({ radius: 4 });
    expect(router.strokeTryBegin(view.event, view.camera, view.pickElement)).toBe(true);
    router.strokeEnd();
    expect(Math.max(...displacementTestOffsetsRead(target))).toBeLessThan(bumpPeak);
    expect(Math.min(...displacementTestOffsetsRead(target))).toBeGreaterThanOrEqual(0);
    expect(getStateDisplacementSculpt().settingsRead().effect).toBe('raise_lower');
  });

  it('paints alpha toward 0 with the right button', () => {
    const { target, router, view } = routerTestPartsCreate();
    routerTestRoutingEnable();
    getStateDisplacementSculpt().settingsWrite({ activeTool: 'paint_alpha', alphaValue: 200, edge: 'hard' });
    router.strokeTryBegin(view.event, view.camera, view.pickElement);
    router.strokeEnd();
    const paintedPeak = Math.max(...displacementTestAlphasRead(target));
    expect(paintedPeak).toBeGreaterThan(0);
    expect(router.strokeTryBegin(view.event, view.camera, view.pickElement, 'secondary')).toBe(true);
    router.strokeEnd();
    expect(Math.max(...displacementTestAlphasRead(target))).toBeLessThan(paintedPeak);
  });

  it('resizes the brush from horizontal travel with Shift + right drag without editing or undo', () => {
    const { rig, target, router, view, keys } = routerTestPartsCreate();
    routerTestRoutingEnable();
    keys.shift = true;
    const radiusBefore = getStateDisplacementSculpt().settingsRead().radius;
    const offsetsBefore = displacementTestOffsetsRead(target);
    const undoCountBefore = rig.commandStack.getUndoCount();
    expect(router.strokeTryBegin(view.event, view.camera, view.pickElement, 'secondary')).toBe(true);
    expect(router.isStrokeActive()).toBe(true);
    const anchor = getStateDisplacementSculptPress().pressRead()?.resizeAnchor ?? null;
    expect(anchor?.point.distanceTo(displacementTestFaceCenter(target))).toBeLessThan(1e-3);
    const travel = BRUSH_RESIZE_PIXELS_PER_DOUBLING;
    expect(router.strokeContinue(routerTestMovedEvent(view, travel), view.camera, view.pickElement)).toBe(true);
    expect(getStateDisplacementSculpt().settingsRead().radius).toBeCloseTo(radiusBefore * 2, 9);
    router.strokeContinue(routerTestMovedEvent(view, -travel), view.camera, view.pickElement);
    expect(getStateDisplacementSculpt().settingsRead().radius).toBeCloseTo(radiusBefore / 2, 9);
    router.strokeContinue(routerTestMovedEvent(view, -travel * 100), view.camera, view.pickElement);
    expect(getStateDisplacementSculpt().settingsRead().radius).toBe(DISPLACEMENT_SCULPT_RADIUS_MIN);
    expect(router.strokeEnd()).toBe(0);
    expect(router.isStrokeActive()).toBe(false);
    expect(getStateDisplacementSculptPress().pressRead()).toBeNull();
    expect(displacementTestOffsetsRead(target)).toEqual(offsetsBefore);
    expect(rig.commandStack.getUndoCount()).toBe(undoCountBefore);
  });

  it('keeps painting every frame with Continuous Mouse and stops when the stroke ends', () => {
    const { rig, target, router, view, scheduler } = routerTestPartsCreate();
    routerTestRoutingEnable();
    getStateDisplacementSculpt().settingsWrite({ continuousMouse: true });
    const undoCountBefore = rig.commandStack.getUndoCount();
    expect(router.strokeTryBegin(view.event, view.camera, view.pickElement)).toBe(true);
    const afterFirstDab = Math.max(...displacementTestOffsetsRead(target));
    scheduler.framesRun(3);
    expect(Math.max(...displacementTestOffsetsRead(target))).toBeGreaterThan(afterFirstDab);
    expect(router.strokeEnd()).toBe(4);
    expect(scheduler.pendingCount()).toBe(0);
    const afterStroke = displacementTestOffsetsRead(target);
    scheduler.framesRun(2);
    expect(displacementTestOffsetsRead(target)).toEqual(afterStroke);
    expect(rig.commandStack.getUndoCount()).toBe(undoCountBefore + 1);
  });

  it('paints only once per press without Continuous Mouse', () => {
    const { router, view, scheduler } = routerTestPartsCreate();
    routerTestRoutingEnable();
    expect(router.strokeTryBegin(view.event, view.camera, view.pickElement)).toBe(true);
    expect(scheduler.pendingCount()).toBe(0);
    expect(router.strokeEnd()).toBe(1);
  });

  it('paints alphas and leaves offsets alone with the Paint Alpha tool', () => {
    const { target, router, view } = routerTestPartsCreate();
    routerTestRoutingEnable();
    getStateDisplacementSculpt().settingsWrite({ activeTool: 'paint_alpha', alphaValue: 200, edge: 'hard' });
    expect(router.isRoutingActive()).toBe(true);
    expect(router.strokeTryBegin(view.event, view.camera, view.pickElement)).toBe(true);
    router.strokeEnd();
    expect(Math.max(...displacementTestAlphasRead(target))).toBeCloseTo(200, 6);
    expect(displacementTestOffsetsRead(target).every((offset) => offset === 0)).toBe(true);
    getStateDisplacementSculpt().settingsWrite({ activeTool: 'select' });
    expect(router.isRoutingActive()).toBe(false);
  });

  it('does not start a stroke when the pointer misses the selected displaced faces', () => {
    const { target, router } = routerTestPartsCreate();
    routerTestRoutingEnable();
    const away = displacementTestFaceCenter(target).add(new THREE.Vector3(50, 0, 0));
    const missView = displacementPickTestViewCreate(away, new THREE.Vector3(0, 1, 0), 8);
    expect(router.strokeTryBegin(missView.event, missView.camera, missView.pickElement)).toBe(false);
    expect(router.strokeEnd()).toBe(0);
  });
});
