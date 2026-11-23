import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import {
  ClipPlanePreview,
  CLIP_CONSTRUCTION_LINE_USERDATA_KEY,
  CLIP_CUT_EDGE_USERDATA_KEY,
} from '@/tools/clip_plane/clip_plane_preview.js';
import { CLIP_PIECE_ROLE_USERDATA_KEY } from '@/tools/clip_plane/clip_plane_half_preview.js';
import { CLIP_SIDE_ARROW_DIRECTION_KEY } from '@/tools/clip_plane/clip_plane_preview_arrows.js';
import { CLIP_MARKER_POINTER_PREVIEW_KEY } from '@/tools/clip_plane/clip_plane_preview_markers.js';
import { CLIP_PLANE_SHEET_USERDATA_KEY } from '@/tools/clip_plane/clip_plane_preview_sheet.js';
import { ToolClipPlane } from '@/tools/clip_plane/tool_clip_plane.js';
import { ClipKeepMode } from '@/tools/clip_plane/clip_keep_mode.js';
import {
  CLIP_MARKER_CORE_PIXELS,
  CLIP_MARKER_HALO_PIXELS,
  CLIP_MARKER_INDEX_KEY,
  getClipPointColor,
} from '@/tools/clip_plane/clip_plane_marker_style.js';
import { worldSizeFromScreenPixels } from '@/transform/bounds/bounds_handle_screen_size.js';
import { Theme } from '@/theme.js';

/** Height in CSS pixels of the fake pane the preview is drawn in. */
const PREVIEW_TEST_PANE_HEIGHT = 400;

/**
 * Builds a renderer stub that reports a pane viewport.
 *
 * @returns Renderer stub.
 */
function paneRendererCreate(): THREE.WebGLRenderer {
  return {
    getViewport: (target: THREE.Vector4) => target.set(0, 0, PREVIEW_TEST_PANE_HEIGHT, PREVIEW_TEST_PANE_HEIGHT),
  } as unknown as THREE.WebGLRenderer;
}

/**
 * Runs every before-render hook under the preview root for one pane camera.
 *
 * @param preview Preview under test.
 * @param camera Pane camera.
 */
function previewRenderPass(preview: ClipPlanePreview, camera: THREE.Camera): void {
  const renderer = paneRendererCreate();
  const scene = new THREE.Scene();
  preview.getRoot().traverse((child) => {
    const drawable = child as THREE.Mesh;
    if (!drawable.material) return;
    child.onBeforeRender(
      renderer,
      scene,
      camera,
      drawable.geometry,
      drawable.material as THREE.Material,
      null as never,
    );
  });
}

/**
 * Returns the preview children carrying a userData flag.
 *
 * @param preview Preview under test.
 * @param key UserData key.
 * @returns Matching objects.
 */
function previewChildrenWith(preview: ClipPlanePreview, key: string): THREE.Object3D[] {
  return preview.getRoot().children.filter((child) => child.userData[key] !== undefined);
}

/**
 * Places a vertical plane through the origin along Z, so its normal lies on the
 * X axis.
 *
 * @param tool Active clip tool.
 */
function placeVerticalPlane(tool: ToolClipPlane): void {
  tool.addPoint(new THREE.Vector3(0, -1, 0));
  tool.addPoint(new THREE.Vector3(0, 1, 0));
}

/**
 * Creates a box target centered at the origin.
 *
 * @returns Target mesh.
 */
function boxTargetCreate(): THREE.Mesh {
  const target = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
  target.updateMatrixWorld(true);
  return target;
}

describe('ClipPlanePreview', () => {
  let preview: ClipPlanePreview;
  let tool: ToolClipPlane;

  beforeEach(() => {
    preview = new ClipPlanePreview();
    tool = new ToolClipPlane();
    tool.activate();
  });

  it('uses distinct colors for the three placement points', () => {
    expect(getClipPointColor(0)).toBe(Theme.clipPoint1Color);
    expect(getClipPointColor(1)).toBe(Theme.clipPoint2Color);
    expect(getClipPointColor(2)).toBe(Theme.clipPoint3Color);
    expect(new Set([getClipPointColor(0), getClipPointColor(1), getClipPointColor(2)]).size).toBe(3);
  });

  it('builds one marker per point, indexed, with the point color in its core', () => {
    placeVerticalPlane(tool);
    preview.syncFromTool(tool);
    const markers = previewChildrenWith(preview, CLIP_MARKER_INDEX_KEY);
    expect(markers.map((marker) => marker.userData[CLIP_MARKER_INDEX_KEY])).toEqual([0, 1]);
    const coreColors = markers.map((marker) => {
      const core = marker.children[marker.children.length - 1] as THREE.Mesh;
      return (core.material as THREE.MeshBasicMaterial).color.getHex();
    });
    expect(coreColors).toEqual([getClipPointColor(0), getClipPointColor(1)]);
  });

  it('keeps markers the same size on screen in near and far panes', () => {
    tool.addPoint(new THREE.Vector3(0, 0, 0));
    preview.syncFromTool(tool);
    const marker = previewChildrenWith(preview, CLIP_MARKER_INDEX_KEY)[0] as THREE.Group;
    const halo = marker.children[0] as THREE.Mesh;
    [4, 40].forEach((distance) => {
      const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
      camera.position.set(0, 0, distance);
      camera.updateMatrixWorld(true);
      previewRenderPass(preview, camera);
      const expected = worldSizeFromScreenPixels(camera, CLIP_MARKER_HALO_PIXELS, PREVIEW_TEST_PANE_HEIGHT, distance);
      expect(halo.scale.x).toBeCloseTo(expected, 6);
    });
  });

  it('sizes markers from the orthographic zoom in 2D panes', () => {
    tool.addPoint(new THREE.Vector3(0, 0, 0));
    preview.syncFromTool(tool);
    const marker = previewChildrenWith(preview, CLIP_MARKER_INDEX_KEY)[0] as THREE.Group;
    const core = marker.children[2] as THREE.Mesh;
    const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
    camera.position.set(0, 10, 0);
    camera.updateMatrixWorld(true);
    previewRenderPass(preview, camera);
    expect(core.scale.x).toBeCloseTo((10 / PREVIEW_TEST_PANE_HEIGHT) * CLIP_MARKER_CORE_PIXELS, 6);
  });

  it('grows the marker under the pointer', () => {
    placeVerticalPlane(tool);
    preview.syncFromTool(tool, [], 1);
    const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
    previewRenderPass(preview, camera);
    const markers = previewChildrenWith(preview, CLIP_MARKER_INDEX_KEY) as THREE.Group[];
    const haloScales = markers.map((marker) => (marker.children[0] as THREE.Mesh).scale.x);
    expect(haloScales[1]).toBeGreaterThan(haloScales[0] ?? Infinity);
  });

  it('shows the point under the pointer and the cut it would make while placing point 2', () => {
    const target = boxTargetCreate();
    tool.addPoint(new THREE.Vector3(0, -1, 0));
    tool.hoverPointSet(new THREE.Vector3(0, 1, 0));
    preview.syncFromTool(tool, [target]);
    expect(previewChildrenWith(preview, CLIP_MARKER_POINTER_PREVIEW_KEY)).toHaveLength(1);
    expect(previewChildrenWith(preview, CLIP_PLANE_SHEET_USERDATA_KEY)).toHaveLength(1);
    expect(previewChildrenWith(preview, CLIP_PIECE_ROLE_USERDATA_KEY).length).toBeGreaterThan(0);
  });

  it('draws a construction polyline between the points', () => {
    placeVerticalPlane(tool);
    preview.syncFromTool(tool);
    const construction = previewChildrenWith(preview, CLIP_CONSTRUCTION_LINE_USERDATA_KEY)[0];
    expect(construction).toBeInstanceOf(THREE.Line);
    expect(construction).not.toBeInstanceOf(THREE.LineSegments);
  });

  it('draws the plane sheet, the cut outline and the removed piece without hiding the target', () => {
    const target = boxTargetCreate();
    placeVerticalPlane(tool);
    preview.syncFromTool(tool, [target]);
    expect(previewChildrenWith(preview, CLIP_PLANE_SHEET_USERDATA_KEY)).toHaveLength(1);
    expect(previewChildrenWith(preview, CLIP_CUT_EDGE_USERDATA_KEY)[0]).toBeInstanceOf(THREE.LineSegments);
    const roles = previewChildrenWith(preview, CLIP_PIECE_ROLE_USERDATA_KEY).map(
      (piece) => piece.userData[CLIP_PIECE_ROLE_USERDATA_KEY],
    );
    expect(roles).toEqual(['discard']);
    expect(target.visible).toBe(true);
  });

  it('points one arrow into the kept side and two opposite arrows when both pieces stay', () => {
    const target = boxTargetCreate();
    placeVerticalPlane(tool);
    const arrowDirections = (): number[] => {
      preview.syncFromTool(tool, [target]);
      return previewChildrenWith(preview, CLIP_SIDE_ARROW_DIRECTION_KEY).map(
        (arrow) => arrow.userData[CLIP_SIDE_ARROW_DIRECTION_KEY] as number,
      );
    };
    expect(arrowDirections()).toEqual([1]);
    tool.keepModeSet(ClipKeepMode.SIDE_B);
    expect(arrowDirections()).toEqual([-1]);
    tool.keepModeSet(ClipKeepMode.BOTH);
    expect(arrowDirections().sort()).toEqual([-1, 1]);
  });

  it('turns the front arrow along the plane normal', () => {
    const target = boxTargetCreate();
    placeVerticalPlane(tool);
    preview.syncFromTool(tool, [target]);
    const arrow = previewChildrenWith(preview, CLIP_SIDE_ARROW_DIRECTION_KEY)[0];
    const plane = tool.getPlane();
    expect(arrow && plane).toBeTruthy();
    const arrowAxis = new THREE.Vector3(0, 1, 0).applyQuaternion(arrow?.quaternion ?? new THREE.Quaternion());
    expect(arrowAxis.dot(plane?.normal ?? new THREE.Vector3())).toBeCloseTo(1, 5);
  });

  it('omits sheet, cut outline and pieces when no targets are supplied', () => {
    placeVerticalPlane(tool);
    preview.syncFromTool(tool, []);
    expect(previewChildrenWith(preview, CLIP_PLANE_SHEET_USERDATA_KEY)).toHaveLength(0);
    expect(previewChildrenWith(preview, CLIP_CUT_EDGE_USERDATA_KEY)).toHaveLength(0);
    expect(previewChildrenWith(preview, CLIP_PIECE_ROLE_USERDATA_KEY)).toHaveLength(0);
  });

  it('clears visuals when the tool is inactive', () => {
    tool.addPoint(new THREE.Vector3(0, 0, 0));
    preview.syncFromTool(tool);
    expect(preview.getRoot().children.length).toBeGreaterThan(0);
    tool.deactivate();
    preview.syncFromTool(tool);
    expect(preview.getRoot().children.length).toBe(0);
  });
});
