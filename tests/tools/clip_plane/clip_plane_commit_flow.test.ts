import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { HandlerClipPlane } from '@/tools/clip_plane/handler_clip_plane.js';
import { ToolClipPlane } from '@/tools/clip_plane/tool_clip_plane.js';
import { ClipKeepMode } from '@/tools/clip_plane/clip_keep_mode.js';
import { CommandStack } from '@/commands/command_stack.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';

/**
 * Builds a box mesh parented under the world for clip tests.
 *
 * @param world World root.
 * @returns Mesh ready to clip.
 */
function addBoxMesh(world: THREE.Group): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial());
  world.add(mesh);
  return mesh;
}

/**
 * Places a vertical cut plane through the origin on the active tool.
 *
 * @param tool Clip plane tool.
 * @returns The placed plane.
 */
function placeVerticalPlane(tool: ToolClipPlane): THREE.Plane {
  tool.activate();
  tool.addPoint(new THREE.Vector3(0, 0, -1));
  tool.addPoint(new THREE.Vector3(0, 0, 1));
  const plane = tool.getPlane();
  expect(plane).not.toBeNull();
  return plane ?? new THREE.Plane();
}

/**
 * Returns the signed distance of a mesh's world bounds center to a plane.
 *
 * @param mesh Result mesh.
 * @param plane Clip plane.
 * @returns Signed distance; positive on the side the normal points to.
 */
function boundsCenterSide(mesh: THREE.Object3D, plane: THREE.Plane): number {
  const center = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
  return plane.distanceToPoint(center);
}

/** Unit tests for applying a clip with each keep mode and continuing to cut. */
describe('ClipPlaneHandler apply flow', () => {
  let worldObject: THREE.Group;
  let clipPlaneTool: ToolClipPlane;
  let selectionManager: ManagerSelection;
  let handler: HandlerClipPlane;

  beforeEach(() => {
    worldObject = new THREE.Group();
    clipPlaneTool = new ToolClipPlane();
    selectionManager = new ManagerSelection();
    handler = new HandlerClipPlane({
      worldObject,
      commandStack: new CommandStack(32),
      selectionManager,
      gridSnap: new GridSnap(false, 1),
      clipPlaneTool,
      modalToolSessionRegistry: { runWithSelectionEndSuppressed: (work: () => void) => work() } as never,
      showStatusMessage: vi.fn(),
      syncPrimitivesToViewports: vi.fn(),
      refreshOutliner: vi.fn(),
      updateShadingMeshes: vi.fn(),
      onToolStateChanged: vi.fn(),
      keyboardShortcutMatches: () => false,
    });
  });

  it('keeps the piece on the normal side for Side A and stays active for the next cut', () => {
    const mesh = addBoxMesh(worldObject);
    selectionManager.selectObject(mesh);
    const plane = placeVerticalPlane(clipPlaneTool);
    handler.applyCut();
    expect(clipPlaneTool.isActive()).toBe(true);
    expect(clipPlaneTool.getPoints()).toHaveLength(0);
    const selected = selectionManager.getAllSelectedObjectsAsArray();
    expect(selected).toHaveLength(1);
    const piece = selected[0];
    expect(piece).toBeDefined();
    expect(piece).not.toBe(mesh);
    expect(piece?.parent).toBe(worldObject);
    expect(boundsCenterSide(piece ?? mesh, plane)).toBeGreaterThan(0);
  });

  it('keeps the piece on the other side for Side B', () => {
    const mesh = addBoxMesh(worldObject);
    selectionManager.selectObject(mesh);
    const plane = placeVerticalPlane(clipPlaneTool);
    handler.keepModeSet(ClipKeepMode.SIDE_B);
    handler.applyCut();
    const selected = selectionManager.getAllSelectedObjectsAsArray();
    expect(selected).toHaveLength(1);
    expect(boundsCenterSide(selected[0] ?? mesh, plane)).toBeLessThan(0);
  });

  it('keeps both pieces for Both, one on each side, and allows another plane', () => {
    const mesh = addBoxMesh(worldObject);
    selectionManager.selectObject(mesh);
    const plane = placeVerticalPlane(clipPlaneTool);
    handler.keepModeSet(ClipKeepMode.BOTH);
    handler.applyCut();
    const selected = selectionManager.getAllSelectedObjectsAsArray();
    expect(selected).toHaveLength(2);
    const sides = selected.map((piece) => Math.sign(boundsCenterSide(piece, plane))).sort();
    expect(sides).toEqual([-1, 1]);
    clipPlaneTool.addPoint(new THREE.Vector3(0.25, 0, -1));
    clipPlaneTool.addPoint(new THREE.Vector3(0.25, 0, 1));
    expect(clipPlaneTool.isPlaneReady()).toBe(true);
    expect(clipPlaneTool.keepModeRead()).toBe(ClipKeepMode.BOTH);
  });

  it('does nothing and keeps the selection when no plane is placed yet', () => {
    const mesh = addBoxMesh(worldObject);
    selectionManager.selectObject(mesh);
    clipPlaneTool.activate();
    clipPlaneTool.addPoint(new THREE.Vector3(0, 0, -1));
    handler.applyCut();
    expect(selectionManager.getAllSelectedObjectsAsArray()).toEqual([mesh]);
    expect(mesh.parent).toBe(worldObject);
  });
});
