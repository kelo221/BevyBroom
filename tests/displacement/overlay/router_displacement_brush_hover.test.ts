import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { findFirstTriangleForBrushSurface } from '@/selection/face/solid_triangle_source_index.js';
import type { FaceSelection } from '@/selection/face/manager_face_selection.js';
import type { SolidFaceTextureTarget } from '@/texture/commands/command_texture_solid_face_edit.js';
import { getStateFaceEditSession } from '@/texture/paint/state_face_edit_session.js';
import { getStateDisplacementSculpt } from '@/displacement/state/state_displacement_sculpt.js';
import { DisplacementBrushCursor } from '@/displacement/overlay/displacement_brush_cursor.js';
import { displacementSurfaceClone } from '@/displacement/model/displacement_face_surface.js';
import { CommandDisplacementEdit } from '@/displacement/commands/command_displacement_edit.js';
import {
  RouterDisplacementBrushHover,
  type DisplacementBrushHoverViewport,
} from '@/displacement/overlay/router_displacement_brush_hover.js';
import {
  displacementTestBoxAdd,
  displacementTestCreate,
  displacementTestFaceCenter,
  displacementTestFaceFacing,
  displacementTestRigCreate,
  displacementTestTarget,
  type DisplacementTestRig,
} from '../displacement_test_rig.js';
import { displacementPickTestViewCreate, type DisplacementPickTestView } from '../displacement_pick_test_view.js';
import { RouterDisplacementSculptPointer } from '@/displacement/sculpt/router_displacement_sculpt_pointer.js';
import { DISPLACEMENT_BRUSH_RESIZE_PIXELS_PER_DOUBLING } from '@/displacement/sculpt/displacement_brush_resize_radius.js';
import { DisplacementSculptFrameSchedulerFake } from '../sculpt/displacement_sculpt_frame_scheduler_fake.js';

/** Router, cursor, displaced face, view and switchable services. */
interface HoverTestParts {
  rig: DisplacementTestRig;
  target: SolidFaceTextureTarget;
  router: RouterDisplacementBrushHover;
  cursor: DisplacementBrushCursor;
  view: DisplacementPickTestView;
  viewports: DisplacementBrushHoverViewport[];
  services: { faceMode: boolean; selected: boolean; shift: boolean };
}

const routersToDispose: Array<{ router: RouterDisplacementBrushHover; cursor: DisplacementBrushCursor }> = [];

/**
 * Builds a face selection holding one result triangle of a face.
 *
 * @param rig Test rig.
 * @param target Selected face.
 * @returns Face selection list.
 */
function hoverTestSelectionBuild(rig: DisplacementTestRig, target: SolidFaceTextureTarget): FaceSelection[] {
  const resultMesh = rig.model.getResultMesh();
  return [
    { mesh: resultMesh, faceIndex: findFirstTriangleForBrushSurface(resultMesh, target.brushId, target.surfaceIndex) },
  ];
}

/**
 * Builds a displaced top face, a view looking down at its center and a hover
 * router whose single viewport is that view.
 *
 * @returns Test parts with face mode on and the face selected.
 */
function hoverTestPartsCreate(): HoverTestParts {
  const rig = displacementTestRigCreate('HoverRouter');
  const brush = displacementTestBoxAdd(rig, new THREE.Vector3(4, 1, 4), new THREE.Vector3(5, -2, 3));
  const target = displacementTestTarget(rig, brush, displacementTestFaceFacing(brush, new THREE.Vector3(0, 1, 0)));
  displacementTestCreate(rig, target, 3);
  const view = displacementPickTestViewCreate(displacementTestFaceCenter(target), new THREE.Vector3(0, 1, 0), 8);
  const viewports: DisplacementBrushHoverViewport[] = [
    { getCamera: () => view.camera, getContentElement: () => view.pickElement },
  ];
  const services = { faceMode: true, selected: true, shift: false };
  const cursor = new DisplacementBrushCursor();
  const router = new RouterDisplacementBrushHover({
    viewportsRead: () => viewports,
    selectedFacesRead: () => (services.selected ? hoverTestSelectionBuild(rig, target) : []),
    isCtrlDown: () => false,
    isShiftDown: () => services.shift,
    isFaceModeActive: () => services.faceMode,
    cursor,
  });
  routersToDispose.push({ router, cursor });
  return { rig, target, router, cursor, view, viewports, services };
}

const sculptRoutersToDispose: RouterDisplacementSculptPointer[] = [];

/**
 * Creates a sculpt router over the hover test's selection whose Shift state is
 * the test services' Shift.
 *
 * @param parts Hover test parts.
 * @returns Sculpt router disposed after the test.
 */
function hoverTestSculptRouterCreate(parts: HoverTestParts): RouterDisplacementSculptPointer {
  const sculptRouter = new RouterDisplacementSculptPointer({
    commandStack: parts.rig.commandStack,
    selectedFacesRead: () => hoverTestSelectionBuild(parts.rig, parts.target),
    isCtrlDown: () => false,
    isShiftDown: () => parts.services.shift,
    afterDab: () => undefined,
    frameScheduler: new DisplacementSculptFrameSchedulerFake(),
  });
  sculptRoutersToDispose.push(sculptRouter);
  return sculptRouter;
}

/** Opens the Displacement tab with the Paint Geometry tool. */
function hoverTestPaintEnable(): void {
  getStateFaceEditSession().sheetOpenWrite(true);
  getStateFaceEditSession().activeTabIdWrite('displacement');
  getStateDisplacementSculpt().settingsWrite({ activeTool: 'paint_geometry', radius: 1.3, distance: 0.25 });
}

/**
 * Binds the router's document listeners, moves the pointer on the document and
 * runs one router frame.
 *
 * @param parts Test parts.
 * @param clientX Pointer client X.
 * @param clientY Pointer client Y.
 */
function hoverTestPointerMove(parts: HoverTestParts, clientX: number, clientY: number): void {
  parts.router.frameRefresh();
  document.dispatchEvent(new MouseEvent('pointermove', { clientX, clientY }));
  parts.router.frameRefresh();
}

/** Paint cursor hover routing over selected displaced faces. */
describe('RouterDisplacementBrushHover', () => {
  afterEach(() => {
    routersToDispose.splice(0).forEach(({ router, cursor }) => {
      router.dispose();
      cursor.dispose();
    });
    sculptRoutersToDispose.splice(0).forEach((sculptRouter) => sculptRouter.dispose());
    getStateFaceEditSession().reset();
    getStateDisplacementSculpt().reset();
  });

  it('keeps the cursor at the press point and grows it live while Shift + right drag resizes', () => {
    const parts = hoverTestPartsCreate();
    hoverTestPaintEnable();
    parts.services.shift = true;
    const sculptRouter = hoverTestSculptRouterCreate(parts);
    const pressX = parts.view.event.clientX;
    const pressY = parts.view.event.clientY;
    hoverTestPointerMove(parts, pressX, pressY);
    expect(sculptRouter.strokeTryBegin(parts.view.event, parts.view.camera, parts.view.pickElement, 'secondary')).toBe(
      true,
    );
    const radiusBefore = getStateDisplacementSculpt().settingsRead().radius;
    const travel = DISPLACEMENT_BRUSH_RESIZE_PIXELS_PER_DOUBLING / 2;
    const moved = new MouseEvent('pointermove', { clientX: pressX + travel, clientY: pressY });
    sculptRouter.strokeContinue(moved, parts.view.camera, parts.view.pickElement);
    hoverTestPointerMove(parts, moved.clientX, moved.clientY);
    const radiusAfter = getStateDisplacementSculpt().settingsRead().radius;
    expect(radiusAfter).toBeGreaterThan(radiusBefore);
    expect(parts.cursor.root.position.distanceTo(displacementTestFaceCenter(parts.target))).toBeLessThan(1e-3);
    expect(parts.cursor.sphere.scale.x).toBeCloseTo(radiusAfter, 9);
    sculptRouter.strokeEnd();
    hoverTestPointerMove(parts, moved.clientX, moved.clientY);
    expect(parts.cursor.root.position.distanceTo(displacementTestFaceCenter(parts.target))).toBeGreaterThan(1e-3);
  });

  it('shows the cursor on the hovered selected displaced surface', () => {
    const parts = hoverTestPartsCreate();
    hoverTestPaintEnable();
    hoverTestPointerMove(parts, parts.view.event.clientX, parts.view.event.clientY);
    expect(parts.cursor.isVisible()).toBe(true);
    expect(parts.cursor.root.position.distanceTo(displacementTestFaceCenter(parts.target))).toBeLessThan(1e-3);
    expect(parts.cursor.sphere.scale.x).toBeCloseTo(1.3, 9);
    expect(parts.cursor.arrow.visible).toBe(true);
  });

  it('hides the cursor when the pointer leaves the viewport or the document', () => {
    const parts = hoverTestPartsCreate();
    hoverTestPaintEnable();
    hoverTestPointerMove(parts, parts.view.event.clientX, parts.view.event.clientY);
    expect(parts.cursor.isVisible()).toBe(true);
    const outside = parts.view.pickElement.getBoundingClientRect().width * 3;
    hoverTestPointerMove(parts, outside, outside);
    expect(parts.cursor.isVisible()).toBe(false);
    hoverTestPointerMove(parts, parts.view.event.clientX, parts.view.event.clientY);
    expect(parts.cursor.isVisible()).toBe(true);
    document.documentElement.dispatchEvent(new MouseEvent('pointerleave'));
    expect(parts.cursor.isVisible()).toBe(false);
    parts.router.frameRefresh();
    expect(parts.cursor.isVisible()).toBe(false);
  });

  it('hides the cursor over surfaces away from the pointer and over unselected faces', () => {
    const parts = hoverTestPartsCreate();
    hoverTestPaintEnable();
    const away = displacementPickTestViewCreate(
      displacementTestFaceCenter(parts.target).add(new THREE.Vector3(40, 0, 0)),
      new THREE.Vector3(0, 1, 0),
      8,
    );
    parts.viewports.splice(0, 1, { getCamera: () => away.camera, getContentElement: () => away.pickElement });
    hoverTestPointerMove(parts, away.event.clientX, away.event.clientY);
    expect(parts.cursor.isVisible()).toBe(false);
    parts.viewports.splice(0, 1, {
      getCamera: () => parts.view.camera,
      getContentElement: () => parts.view.pickElement,
    });
    parts.services.selected = false;
    hoverTestPointerMove(parts, parts.view.event.clientX, parts.view.event.clientY);
    expect(parts.cursor.isVisible()).toBe(false);
  });

  it('sits on the sculpted surface and back on the restored surface after undo', () => {
    const parts = hoverTestPartsCreate();
    hoverTestPaintEnable();
    const flatCenter = displacementTestFaceCenter(parts.target);
    const raise = getStateDisplacementSculpt().settingsRead().radius;
    const stored = parts.rig.model.findBrush(parts.target.brushId)?.faceDisplacementRead(parts.target.surfaceIndex);
    if (!stored) throw new Error('target face has no displacement');
    const raised = displacementSurfaceClone(stored);
    raised.offsets = raised.offsets.map(() => raise);
    parts.rig.commandStack.push(new CommandDisplacementEdit([{ target: parts.target, displacement: raised }]));
    hoverTestPointerMove(parts, parts.view.event.clientX, parts.view.event.clientY);
    expect(parts.cursor.root.position.y - flatCenter.y).toBeCloseTo(raise, 6);
    parts.rig.commandStack.undo();
    hoverTestPointerMove(parts, parts.view.event.clientX, parts.view.event.clientY);
    expect(parts.cursor.root.position.distanceTo(flatCenter)).toBeLessThan(1e-3);
  });

  it('shows nothing with the Select tool, outside the Displacement tab or outside face mode', () => {
    const parts = hoverTestPartsCreate();
    hoverTestPointerMove(parts, parts.view.event.clientX, parts.view.event.clientY);
    expect(parts.cursor.isVisible()).toBe(false);
    hoverTestPaintEnable();
    parts.services.faceMode = false;
    parts.router.frameRefresh();
    expect(parts.cursor.isVisible()).toBe(false);
    parts.services.faceMode = true;
    parts.router.frameRefresh();
    expect(parts.cursor.isVisible()).toBe(true);
    getStateFaceEditSession().activeTabIdWrite('material');
    parts.router.frameRefresh();
    expect(parts.cursor.isVisible()).toBe(false);
  });
});
