import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { findFirstTriangleForBrushSurface } from '@/selection/face/solid_triangle_source_index.js';
import type { FaceSelection } from '@/selection/face/manager_face_selection.js';
import { getStateFaceEditSession } from '@/texture/paint/state_face_edit_session.js';
import { getStateDisplacementSculpt } from '@/displacement/state/state_displacement_sculpt.js';
import { RouterDisplacementSculptPointer } from '@/displacement/sculpt/router_displacement_sculpt_pointer.js';
import { DisplacementSculptFace } from '@/displacement/sculpt/displacement_sculpt_face.js';
import type { SolidFaceTextureTarget } from '@/texture/commands/command_texture_solid_face_edit.js';
import {
  displacementTestBoxAdd,
  displacementTestCreate,
  displacementTestFaceFacing,
  displacementTestOffsetsRead,
  displacementTestRigCreate,
  displacementTestTarget,
  type DisplacementTestRig,
} from '../displacement_test_rig.js';
import { displacementPickTestViewCreate, type DisplacementPickTestView } from '../displacement_pick_test_view.js';

/** Router, rig, displaced face and a view aimed at the face center. */
interface RouterTestParts {
  rig: DisplacementTestRig;
  target: SolidFaceTextureTarget;
  router: RouterDisplacementSculptPointer;
  view: DisplacementPickTestView;
  ctrl: { down: boolean };
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
  const ctrl = { down: false };
  const router = new RouterDisplacementSculptPointer({
    commandStack: rig.commandStack,
    selectedFacesRead: () => routerTestSelectionBuild(rig, target),
    isCtrlDown: () => ctrl.down,
    afterDab: () => undefined,
  });
  const view = displacementPickTestViewCreate(routerTestFaceCenter(target), new THREE.Vector3(0, 1, 0), 8);
  return { rig, target, router, view, ctrl };
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
 * Returns the world center of the flat grid of a displaced face.
 *
 * @param target Displaced face.
 * @returns World-space center.
 */
function routerTestFaceCenter(target: SolidFaceTextureTarget): THREE.Vector3 {
  const face = DisplacementSculptFace.fromTarget(target);
  if (!face) throw new Error('face has no displacement');
  const sum = face.placement.basePositions.reduce((total, point) => total.add(point), new THREE.Vector3());
  return sum.multiplyScalar(1 / face.placement.basePositions.length);
}

/** Turns on the Displacement tab and Paint Geometry. */
function routerTestRoutingEnable(): void {
  getStateFaceEditSession().sheetOpenWrite(true);
  getStateFaceEditSession().activeTabIdWrite('displacement');
  getStateDisplacementSculpt().settingsWrite({
    paintEnabled: true,
    tool: 'raise_lower',
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
    const { target, router, view, ctrl } = routerTestPartsCreate();
    routerTestRoutingEnable();
    ctrl.down = true;
    expect(router.strokeTryBegin(view.event, view.camera, view.pickElement)).toBe(true);
    router.strokeEnd();
    expect(Math.min(...displacementTestOffsetsRead(target))).toBeLessThan(0);
  });

  it('does not start a stroke when the pointer misses the selected displaced faces', () => {
    const { target, router } = routerTestPartsCreate();
    routerTestRoutingEnable();
    const away = routerTestFaceCenter(target).add(new THREE.Vector3(50, 0, 0));
    const missView = displacementPickTestViewCreate(away, new THREE.Vector3(0, 1, 0), 8);
    expect(router.strokeTryBegin(missView.event, missView.camera, missView.pickElement)).toBe(false);
    expect(router.strokeEnd()).toBe(0);
  });
});
