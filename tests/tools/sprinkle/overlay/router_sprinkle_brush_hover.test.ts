import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SprinkleBrushCursor } from '@/tools/sprinkle/overlay/sprinkle_brush_cursor.js';
import {
  RouterSprinkleBrushHover,
  type SprinkleBrushHoverPress,
  type SprinkleBrushHoverViewport,
} from '@/tools/sprinkle/overlay/router_sprinkle_brush_hover.js';
import { Theme } from '@/theme.js';
import { getStateSprinkleTool } from '@/tools/sprinkle/state_sprinkle_tool.js';
import {
  SPRINKLE_RADIUS_WHEEL_NOTCH_DOUBLINGS,
  sprinkleRadiusWheelConsume,
} from '@/tools/sprinkle/radius/sprinkle_radius_wheel_consumer.js';

/** Side length, in pixels, of the fake viewport element. */
const HOVER_TEST_VIEW_SIZE_PX = 200;

/** Camera, selectable meshes, element and centered pointer event. */
interface HoverTestView {
  camera: THREE.PerspectiveCamera;
  meshes: THREE.Mesh[];
  pickElement: HTMLElement;
  event: MouseEvent;
}

/** Router, cursor and viewports of one test. */
interface HoverTestParts {
  router: RouterSprinkleBrushHover;
  cursor: SprinkleBrushCursor;
  view: HoverTestView;
  viewports: SprinkleBrushHoverViewport[];
}

const routersToDispose: Array<{ router: RouterSprinkleBrushHover; cursor: SprinkleBrushCursor }> = [];

/**
 * Builds a camera that looks at a point from along a direction and a pointer
 * event at the center of a fake viewport element, so a pick ray passes through
 * the point.
 *
 * @param target World point the ray must pass through.
 * @param from Direction from the target to the camera.
 * @param distance Camera distance from the target.
 * @returns Camera, element and event.
 */
function hoverTestViewCreate(target: THREE.Vector3, from: THREE.Vector3, distance: number): HoverTestView {
  const camera = new THREE.PerspectiveCamera(50, 1, 0.01, 1000);
  camera.position.copy(target).addScaledVector(from.clone().normalize(), distance);
  camera.up.set(0, 0, -1);
  camera.lookAt(target);
  camera.updateMatrixWorld(true);
  const pickElement = document.createElement('div');
  pickElement.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: HOVER_TEST_VIEW_SIZE_PX,
      bottom: HOVER_TEST_VIEW_SIZE_PX,
      width: HOVER_TEST_VIEW_SIZE_PX,
      height: HOVER_TEST_VIEW_SIZE_PX,
    }) as DOMRect;
  const center = HOVER_TEST_VIEW_SIZE_PX / 2;
  const event = new MouseEvent('pointermove', { clientX: center, clientY: center });
  return { camera, meshes: [], pickElement, event };
}

/**
 * Builds a box mesh centered on a point so the pick ray hits its top surface.
 *
 * @param center World center of the box.
 * @param size Side length of the box.
 * @returns Mesh with world matrices updated.
 */
function hoverTestMeshCreate(center: THREE.Vector3, size: number): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(size, size, size);
  const mesh = new THREE.Mesh(geometry);
  mesh.position.copy(center);
  mesh.updateMatrixWorld(true);
  return mesh;
}

/**
 * Builds a hover router whose single viewport looks down at a box top face
 * through its center.
 *
 * @param press Press state the cursor follows, or none.
 * @returns Test parts with the Sprinkle tool active.
 */
function hoverTestPartsCreate(press?: SprinkleBrushHoverPress): HoverTestParts {
  const topCenter = new THREE.Vector3(2, 1, 3);
  const view = hoverTestViewCreate(topCenter, new THREE.Vector3(0, 1, 0), 8);
  view.meshes.push(hoverTestMeshCreate(topCenter.clone().setY(0.5), 1));
  const viewports: SprinkleBrushHoverViewport[] = [
    {
      getCamera: () => view.camera,
      getContentElement: () => view.pickElement,
      getSelectableObjects: () => view.meshes,
    },
  ];
  const cursor = new SprinkleBrushCursor();
  const router = new RouterSprinkleBrushHover({ viewportsRead: () => viewports, cursor, ...(press ? { press } : {}) });
  routersToDispose.push({ router, cursor });
  getStateSprinkleTool().toolActiveWrite(true);
  return { router, cursor, view, viewports };
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

/** Sprinkle radius cursor hover routing over scene surfaces. */
describe('RouterSprinkleBrushHover', () => {
  afterEach(() => {
    routersToDispose.splice(0).forEach(({ router, cursor }) => {
      router.dispose();
      cursor.dispose();
    });
    getStateSprinkleTool().reset();
  });

  it('shows the cursor on the hovered scene surface sized to the sprinkle radius', () => {
    const parts = hoverTestPartsCreate();
    const radius = getStateSprinkleTool().configRead().radius;
    hoverTestPointerMove(parts, parts.view.event.clientX, parts.view.event.clientY);
    expect(parts.cursor.isVisible()).toBe(true);
    expect(parts.cursor.root.position.distanceTo(new THREE.Vector3(2, 1, 3))).toBeLessThan(1e-3);
    expect(parts.cursor.sphere.scale.x).toBeCloseTo(radius, 9);
  });

  it('follows radius changes live while the option bar edits the radius', () => {
    const parts = hoverTestPartsCreate();
    hoverTestPointerMove(parts, parts.view.event.clientX, parts.view.event.clientY);
    getStateSprinkleTool().configPatch({ radius: 2.5 });
    parts.router.frameRefresh();
    expect(parts.cursor.sphere.scale.x).toBeCloseTo(2.5, 9);
  });

  it('resizes on the next frame after an Alt+wheel radius step', () => {
    const parts = hoverTestPartsCreate();
    hoverTestPointerMove(parts, parts.view.event.clientX, parts.view.event.clientY);
    const radiusBefore = getStateSprinkleTool().configRead().radius;
    sprinkleRadiusWheelConsume(new WheelEvent('wheel', { deltaY: -1, altKey: true }));
    parts.router.frameRefresh();
    const expectedRadius = radiusBefore * Math.pow(2, SPRINKLE_RADIUS_WHEEL_NOTCH_DOUBLINGS);
    expect(parts.cursor.sphere.scale.x).toBeCloseTo(expectedRadius, 9);
  });

  it('hides the cursor when the pointer leaves the viewport or the document', () => {
    const parts = hoverTestPartsCreate();
    hoverTestPointerMove(parts, parts.view.event.clientX, parts.view.event.clientY);
    expect(parts.cursor.isVisible()).toBe(true);
    const outside = HOVER_TEST_VIEW_SIZE_PX * 3;
    hoverTestPointerMove(parts, outside, outside);
    expect(parts.cursor.isVisible()).toBe(false);
    hoverTestPointerMove(parts, parts.view.event.clientX, parts.view.event.clientY);
    expect(parts.cursor.isVisible()).toBe(true);
    document.documentElement.dispatchEvent(new MouseEvent('pointerleave'));
    expect(parts.cursor.isVisible()).toBe(false);
    parts.router.frameRefresh();
    expect(parts.cursor.isVisible()).toBe(false);
  });

  it('hides the cursor over surfaces away from the pointer', () => {
    const parts = hoverTestPartsCreate();
    const away = hoverTestViewCreate(new THREE.Vector3(40, 1, 3), new THREE.Vector3(0, 1, 0), 8);
    parts.viewports.splice(0, 1, {
      getCamera: () => away.camera,
      getContentElement: () => away.pickElement,
      getSelectableObjects: () => parts.view.meshes,
    });
    hoverTestPointerMove(parts, away.event.clientX, away.event.clientY);
    expect(parts.cursor.isVisible()).toBe(false);
  });

  it('shows nothing while the Sprinkle tool is inactive', () => {
    const parts = hoverTestPartsCreate();
    getStateSprinkleTool().toolActiveWrite(false);
    hoverTestPointerMove(parts, parts.view.event.clientX, parts.view.event.clientY);
    expect(parts.cursor.isVisible()).toBe(false);
    getStateSprinkleTool().toolActiveWrite(true);
    parts.router.frameRefresh();
    expect(parts.cursor.isVisible()).toBe(true);
  });

  it('stays at the resize anchor while the brush is resized', () => {
    const anchor = new THREE.Vector3(-6, 2.5, 4);
    const parts = hoverTestPartsCreate({ resizeAnchorRead: () => anchor, isSubtractiveShown: () => false });
    hoverTestPointerMove(parts, parts.view.event.clientX, parts.view.event.clientY);
    expect(parts.cursor.root.position.distanceTo(anchor)).toBeLessThan(1e-9);
  });

  it('shows the subtractive color while painting would remove entities', () => {
    const subtractive = { value: false };
    const parts = hoverTestPartsCreate({ resizeAnchorRead: () => null, isSubtractiveShown: () => subtractive.value });
    hoverTestPointerMove(parts, parts.view.event.clientX, parts.view.event.clientY);
    expect(parts.cursor.colorHexRead()).toBe(Theme.sprinkleCursorSphereColor);
    subtractive.value = true;
    parts.router.frameRefresh();
    expect(parts.cursor.colorHexRead()).toBe(Theme.sprinkleCursorSubtractiveColor);
  });
});
