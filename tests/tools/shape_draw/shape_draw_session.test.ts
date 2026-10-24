import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CommandStack } from '@/commands/command_stack.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import { ObjectDragGridFrame } from '@/tools/object_drag/object_drag_grid_frame.js';
import { objectDragPointerSampleCreate } from '@/tools/object_drag/object_drag_pointer_sample.js';
import { ShapeDrawBrushCommit } from '@/tools/shape_draw/shape_draw_brush_commit.js';
import { shapeDrawRangeSnapOutward } from '@/tools/shape_draw/shape_draw_bounds_math.js';
import { SHAPE_DRAW_PREVIEW_USERDATA_KEY, type ShapeDrawPreviewHost } from '@/tools/shape_draw/shape_draw_preview.js';
import { ShapeDrawSession } from '@/tools/shape_draw/shape_draw_session.js';
import { ShapeDrawSettings } from '@/tools/shape_draw/shapes/shape_draw_settings.js';
import { ViewportKind } from '@/viewports/core/viewport_kind.js';
import {
  objectDragTestBoxMeshCreate,
  objectDragTestClientPoint,
  objectDragTestViewportCreate,
  type ObjectDragTestViewport,
} from '../object_drag/object_drag_test_viewport.js';

/** Modifier keys held during one pointer sample. */
interface ShapeDrawTestKeys {
  shiftKey?: boolean;
  altKey?: boolean;
}

/** Everything a shape draw session test drives and inspects. */
interface ShapeDrawTestRig {
  testViewport: ObjectDragTestViewport;
  gridSnap: GridSnap;
  model: SolidModel;
  world: THREE.Group;
  helpers: THREE.Group;
  commandStack: CommandStack;
  selection: ManagerSelection;
  snap: { enabled: boolean };
  referenceBounds: THREE.Box3;
  shapeSettings: ShapeDrawSettings;
}

/**
 * Builds a rig with an empty solid model in a world, a helper group and a view.
 *
 * @param kind View kind the session draws in.
 * @returns Test rig.
 */
function shapeDrawRigCreate(kind: ViewportKind): ShapeDrawTestRig {
  const world = new THREE.Group();
  const model = new SolidModel('ShapeDrawTarget');
  world.add(model.root);
  const halfEdge = 1;
  return {
    testViewport: objectDragTestViewportCreate(kind),
    gridSnap: new GridSnap(true, 0.5),
    model,
    world,
    helpers: new THREE.Group(),
    commandStack: new CommandStack(64),
    selection: new ManagerSelection(),
    snap: { enabled: true },
    referenceBounds: new THREE.Box3(
      new THREE.Vector3(-halfEdge, -halfEdge, -halfEdge),
      new THREE.Vector3(halfEdge, halfEdge, halfEdge),
    ),
    shapeSettings: new ShapeDrawSettings(),
  };
}

/**
 * Starts a session in the rig with the press over a world point.
 *
 * @param rig Test rig.
 * @param pressWorld World point under the press.
 * @returns Running session.
 */
function shapeDrawSessionStart(rig: ShapeDrawTestRig, pressWorld: THREE.Vector3): ShapeDrawSession {
  const press = objectDragTestClientPoint(rig.testViewport, pressWorld);
  return new ShapeDrawSession(
    {
      viewport: rig.testViewport.viewport,
      gridFrame: new ObjectDragGridFrame(rig.gridSnap),
      snapEnabledRead: () => rig.snap.enabled,
      referenceBoundsResolve: () => rig.referenceBounds.clone(),
      previewHost: shapeDrawPreviewHostCreate(rig),
      brushCommit: shapeDrawBrushCommitCreate(rig),
      shapeSettings: rig.shapeSettings,
    },
    press.clientX,
    press.clientY,
  );
}

/**
 * Builds the helper scene host of a rig.
 *
 * @param rig Test rig.
 * @returns Preview host over the rig helper group.
 */
function shapeDrawPreviewHostCreate(rig: ShapeDrawTestRig): ShapeDrawPreviewHost {
  return {
    addHelper: (object) => rig.helpers.add(object),
    removeHelper: (object) => rig.helpers.remove(object),
  };
}

/**
 * Builds the shape committer of a rig.
 *
 * @param rig Test rig.
 * @returns Shape committer over the rig systems.
 */
function shapeDrawBrushCommitCreate(rig: ShapeDrawTestRig): ShapeDrawBrushCommit {
  return new ShapeDrawBrushCommit({
    commandStack: rig.commandStack,
    worldObject: rig.world,
    selectObject: (mesh) => rig.selection.selectObject(mesh),
    selectObjects: (meshes) => rig.selection.setSelection(meshes),
    activeModelResolve: () => rig.model,
    brushInsertParentResolve: (model) => model.root,
    textureIdResolve: () => null,
    afterWorldMutation: () => {},
  });
}

/**
 * Moves the session pointer over a world point.
 *
 * @param rig Test rig.
 * @param session Running session.
 * @param pointerWorld World point under the pointer.
 * @param keys Held modifier keys.
 */
function shapeDrawPointerMove(
  rig: ShapeDrawTestRig,
  session: ShapeDrawSession,
  pointerWorld: THREE.Vector3,
  keys: ShapeDrawTestKeys = {},
): void {
  const point = objectDragTestClientPoint(rig.testViewport, pointerWorld);
  session.update(
    objectDragPointerSampleCreate(point.clientX, point.clientY, {
      shiftKey: keys.shiftKey ?? false,
      ctrlKey: false,
      altKey: keys.altKey ?? false,
    }),
  );
}

/**
 * Returns the world bounds of the only brush the session created.
 *
 * @param rig Test rig.
 * @returns World bounds of the selected new brush.
 */
function shapeDrawCreatedBrushBounds(rig: ShapeDrawTestRig): THREE.Box3 {
  const selected = rig.selection.getAllSelectedObjectsAsArray();
  expect(selected.length).toBe(1);
  expect(rig.model.getBrushCount()).toBe(1);
  const mesh = selected[0] as THREE.Mesh;
  mesh.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(mesh);
}

/**
 * Asserts a box axis spans a range.
 *
 * @param box Measured box.
 * @param axis Axis to check.
 * @param range Expected range.
 * @param range.minimum Expected minimum.
 * @param range.maximum Expected maximum.
 */
function expectAxisRange(box: THREE.Box3, axis: 'x' | 'y' | 'z', range: { minimum: number; maximum: number }): void {
  expect(box.min[axis]).toBeCloseTo(range.minimum, 4);
  expect(box.max[axis]).toBeCloseTo(range.maximum, 4);
}

/**
 * Proves dragging on empty space draws the expected box brush in the
 * perspective view and in 2D views, with snapping, Shift, Alt and cancel.
 */
describe('ShapeDrawSession', () => {
  const pressWorld = new THREE.Vector3(0.7, 0, 0.3);
  const cornerWorld = new THREE.Vector3(3.1, 0, -1.6);

  it('draws a grid-snapped footprint one grid step tall on the grid plane in perspective', () => {
    const rig = shapeDrawRigCreate(ViewportKind.PERSPECTIVE);
    const step = rig.gridSnap.getInterval();
    const session = shapeDrawSessionStart(rig, pressWorld);
    shapeDrawPointerMove(rig, session, cornerWorld);
    session.commit();
    const bounds = shapeDrawCreatedBrushBounds(rig);
    expectAxisRange(bounds, 'x', shapeDrawRangeSnapOutward(pressWorld.x, cornerWorld.x, step));
    expectAxisRange(bounds, 'z', shapeDrawRangeSnapOutward(cornerWorld.z, pressWorld.z, step));
    expectAxisRange(bounds, 'y', { minimum: pressWorld.y, maximum: pressWorld.y + step });
    expect(rig.commandStack.getUndoCount()).toBe(1);
  });

  it('shows an editor-only preview while dragging and removes it on commit', () => {
    const rig = shapeDrawRigCreate(ViewportKind.PERSPECTIVE);
    const session = shapeDrawSessionStart(rig, pressWorld);
    shapeDrawPointerMove(rig, session, cornerWorld);
    const preview = session.previewObject();
    expect(preview.parent).toBe(rig.helpers);
    expect(preview.userData[SHAPE_DRAW_PREVIEW_USERDATA_KEY]).toBe(true);
    expect(rig.world.getObjectById(preview.id)).toBeUndefined();
    session.commit();
    expect(preview.parent).toBeNull();
  });

  it('keeps the exact dragged footprint when snapping is off', () => {
    const rig = shapeDrawRigCreate(ViewportKind.PERSPECTIVE);
    rig.snap.enabled = false;
    const session = shapeDrawSessionStart(rig, pressWorld);
    shapeDrawPointerMove(rig, session, cornerWorld);
    session.commit();
    const bounds = shapeDrawCreatedBrushBounds(rig);
    expectAxisRange(bounds, 'x', { minimum: pressWorld.x, maximum: cornerWorld.x });
    expectAxisRange(bounds, 'z', { minimum: cornerWorld.z, maximum: pressWorld.z });
  });

  it('squares the footprint while Shift is held', () => {
    const rig = shapeDrawRigCreate(ViewportKind.PERSPECTIVE);
    const session = shapeDrawSessionStart(rig, pressWorld);
    shapeDrawPointerMove(rig, session, cornerWorld, { shiftKey: true });
    const size = session.currentLocalBox()?.getSize(new THREE.Vector3());
    expect(size?.x).toBeCloseTo(size?.z ?? Number.NaN, 6);
    session.cancel();
  });

  it('sets the height while Alt is held without moving the footprint', () => {
    const rig = shapeDrawRigCreate(ViewportKind.PERSPECTIVE);
    const step = rig.gridSnap.getInterval();
    const height = 2.3;
    const session = shapeDrawSessionStart(rig, pressWorld);
    shapeDrawPointerMove(rig, session, cornerWorld);
    const footprintBefore = session.currentLocalBox();
    shapeDrawPointerMove(rig, session, cornerWorld.clone().add(new THREE.Vector3(0, height, 0)), { altKey: true });
    const box = session.currentLocalBox();
    expect(box?.max.y).toBeCloseTo(shapeDrawRangeSnapOutward(0, height, step).maximum, 4);
    expect(box?.min.x).toBeCloseTo(footprintBefore?.min.x ?? Number.NaN, 6);
    expect(box?.max.z).toBeCloseTo(footprintBefore?.max.z ?? Number.NaN, 6);
    session.cancel();
  });

  it('starts on the surface under the press and grows away from it', () => {
    const rig = shapeDrawRigCreate(ViewportKind.PERSPECTIVE);
    const step = rig.gridSnap.getInterval();
    const pedestalSize = new THREE.Vector3(10, 2, 10);
    const pedestal = objectDragTestBoxMeshCreate(
      rig.world,
      pedestalSize,
      new THREE.Vector3(0, -pedestalSize.y / 2 + 1, 0),
    );
    rig.testViewport.meshes.push(pedestal);
    const topY = new THREE.Box3().setFromObject(pedestal).max.y;
    const session = shapeDrawSessionStart(rig, new THREE.Vector3(pressWorld.x, topY, pressWorld.z));
    shapeDrawPointerMove(rig, session, new THREE.Vector3(cornerWorld.x, topY, cornerWorld.z));
    session.commit();
    const bounds = shapeDrawCreatedBrushBounds(rig);
    expectAxisRange(bounds, 'y', { minimum: topY, maximum: topY + step });
  });

  it('creates nothing and leaves no preview or history when cancelled', () => {
    const rig = shapeDrawRigCreate(ViewportKind.PERSPECTIVE);
    const session = shapeDrawSessionStart(rig, pressWorld);
    shapeDrawPointerMove(rig, session, cornerWorld);
    session.cancel();
    expect(session.isFinished()).toBe(true);
    expect(rig.helpers.children.length).toBe(0);
    expect(rig.model.getBrushCount()).toBe(0);
    expect(rig.commandStack.canUndo()).toBe(false);
  });

  it('draws the view rectangle in the top view with the depth of the reference bounds', () => {
    const rig = shapeDrawRigCreate(ViewportKind.TOP);
    const step = rig.gridSnap.getInterval();
    const session = shapeDrawSessionStart(rig, pressWorld);
    shapeDrawPointerMove(rig, session, cornerWorld);
    session.commit();
    const bounds = shapeDrawCreatedBrushBounds(rig);
    expectAxisRange(bounds, 'x', shapeDrawRangeSnapOutward(pressWorld.x, cornerWorld.x, step));
    expectAxisRange(bounds, 'z', shapeDrawRangeSnapOutward(cornerWorld.z, pressWorld.z, step));
    expectAxisRange(bounds, 'y', { minimum: rig.referenceBounds.min.y, maximum: rig.referenceBounds.max.y });
  });

  it('takes the front view depth along Z from the reference bounds', () => {
    const rig = shapeDrawRigCreate(ViewportKind.FRONT);
    rig.referenceBounds.set(new THREE.Vector3(-3, 2, -0.75), new THREE.Vector3(4, 5, 1.25));
    const session = shapeDrawSessionStart(rig, new THREE.Vector3(0.6, 0.4, 0));
    shapeDrawPointerMove(rig, session, new THREE.Vector3(2.2, 3.1, 0));
    session.commit();
    const bounds = shapeDrawCreatedBrushBounds(rig);
    expectAxisRange(bounds, 'z', { minimum: rig.referenceBounds.min.z, maximum: rig.referenceBounds.max.z });
  });

  it('creates nothing when committed before the pointer moved', () => {
    const rig = shapeDrawRigCreate(ViewportKind.PERSPECTIVE);
    const session = shapeDrawSessionStart(rig, pressWorld);
    session.commit();
    expect(rig.model.getBrushCount()).toBe(0);
    expect(rig.helpers.children.length).toBe(0);
  });

  it('draws the selected multi-piece shape as one grouped commit', () => {
    const rig = shapeDrawRigCreate(ViewportKind.PERSPECTIVE);
    const stepHeight = 0.5;
    const drawnHeight = 2;
    rig.shapeSettings.shapeSelect('stairs');
    rig.shapeSettings.parameterSet('stairs', 'stepHeight', stepHeight);
    const session = shapeDrawSessionStart(rig, pressWorld);
    shapeDrawPointerMove(rig, session, cornerWorld);
    shapeDrawPointerMove(rig, session, cornerWorld.clone().add(new THREE.Vector3(0, drawnHeight, 0)), { altKey: true });
    session.commit();
    const stepCount = Math.ceil(drawnHeight / stepHeight);
    expect(rig.model.getBrushCount()).toBe(stepCount);
    const selected = rig.selection.getAllSelectedObjectsAsArray();
    expect(selected.length).toBe(stepCount);
    const group = selected[0]?.parent;
    expect(group?.name).toBe('Stairs');
    expect(group?.children.length).toBe(stepCount);
    expect(rig.commandStack.getUndoCount()).toBe(1);
    rig.commandStack.undo();
    expect(rig.model.getBrushCount()).toBe(0);
  });
});
