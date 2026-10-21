import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CommandStack } from '@/commands/command_stack.js';
import type { UndoCommand } from '@/commands/command_undo.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { GizmoTransform } from '@/transform/gizmo/gizmo_transform.js';
import { TransformCommandPusher } from '@/transform/core/transform_command_pusher.js';
import { TransformExecutor } from '@/transform/core/transform_executor.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import { Theme } from '@/theme.js';
import { ObjectDragGridFrame } from '@/tools/object_drag/object_drag_grid_frame.js';
import { objectDragPointerSampleCreate } from '@/tools/object_drag/object_drag_pointer_sample.js';
import { ObjectDragMoveSession } from '@/tools/object_drag_move/object_drag_move_session.js';
import { ViewportKind } from '@/viewports/core/viewport_kind.js';
import {
  objectDragTestBoxMeshCreate,
  objectDragTestClientPoint,
  objectDragTestViewportCreate,
  type ObjectDragTestViewport,
} from '../object_drag/object_drag_test_viewport.js';

/**
 * Undoable copy of meshes that selects the copies, standing in for Ctrl
 * duplicate.
 */
class CommandTestMeshDuplicate implements UndoCommand {
  readonly copies: THREE.Mesh[];

  /**
   * Prepares copies of the source meshes.
   *
   * @param sources Meshes to copy (each must have a parent).
   * @param selection Selection that receives the copies.
   */
  constructor(
    private readonly sources: THREE.Mesh[],
    private readonly selection: ManagerSelection,
  ) {
    this.copies = sources.map((source) => source.clone());
  }

  /** Adds the copies next to their sources and selects them. */
  execute(): void {
    this.copies.forEach((copy, index) => this.sources[index]?.parent?.add(copy));
    this.selection.setSelection(this.copies);
  }

  /** Removes the copies. */
  undo(): void {
    this.copies.forEach((copy) => copy.removeFromParent());
  }
}

/** Everything a move session test drives and inspects. */
interface MoveTestRig {
  testViewport: ObjectDragTestViewport;
  gridSnap: GridSnap;
  world: THREE.Group;
  mesh: THREE.Mesh;
  selection: ManagerSelection;
  commandStack: CommandStack;
  duplicates: CommandTestMeshDuplicate[];
  counters: { afterCommit: number; afterCancel: number };
}

/**
 * Builds a rig with one selected box standing on the grid.
 *
 * @param kind View kind the move happens in.
 * @returns Test rig.
 */
function moveRigCreate(kind: ViewportKind): MoveTestRig {
  const world = new THREE.Group();
  const size = new THREE.Vector3(2, 2, 2);
  const mesh = objectDragTestBoxMeshCreate(world, size, new THREE.Vector3(0.5, size.y / 2, -0.5));
  const selection = new ManagerSelection();
  selection.selectObject(mesh);
  return {
    testViewport: objectDragTestViewportCreate(kind, [mesh]),
    gridSnap: new GridSnap(true, 0.5),
    world,
    mesh,
    selection,
    commandStack: new CommandStack(64),
    duplicates: [],
    counters: { afterCommit: 0, afterCancel: 0 },
  };
}

/**
 * Starts a move session with the press over a world point of the mesh.
 *
 * @param rig Test rig.
 * @param pressWorld World point on the mesh under the press.
 * @param options Press modifiers.
 * @param options.duplicate True to duplicate before moving.
 * @param options.altKey True when Alt is held at the press.
 * @returns Running session.
 */
function moveSessionStart(
  rig: MoveTestRig,
  pressWorld: THREE.Vector3,
  options: { duplicate?: boolean; altKey?: boolean } = {},
): ObjectDragMoveSession {
  const press = objectDragTestClientPoint(rig.testViewport, pressWorld);
  const executor = new TransformExecutor(rig.gridSnap);
  const gizmo = new GizmoTransform(Theme);
  return new ObjectDragMoveSession(
    {
      viewport: rig.testViewport.viewport,
      gridFrame: new ObjectDragGridFrame(rig.gridSnap),
      gridSnap: rig.gridSnap,
      userSnapEnabledRead: () => true,
      transformExecutor: executor,
      commandStack: rig.commandStack,
      selection: rig.selection,
      transformTargetsResolve: () => rig.selection.getAllSelectedObjectsAsArray(),
      duplicateHierarchyObjects: (objects) => moveRigDuplicate(rig, objects),
      translateUndoPush: (dragSession, targets) =>
        new TransformCommandPusher(dragSession, gizmo, executor, rig.commandStack).pushTranslateCommand(targets),
      textureLockRebake: () => {},
      liveVisuals: {},
      afterCommit: () => rig.counters.afterCommit++,
      afterCancel: () => rig.counters.afterCancel++,
    },
    {
      pressClientX: press.clientX,
      pressClientY: press.clientY,
      pressedMesh: rig.mesh,
      duplicate: options.duplicate ?? false,
      altKey: options.altKey ?? false,
    },
  );
}

/**
 * Duplicates meshes through an undoable command on the rig's stack.
 *
 * @param rig Test rig.
 * @param objects Objects to duplicate.
 */
function moveRigDuplicate(rig: MoveTestRig, objects: THREE.Object3D[]): void {
  const meshes = objects.filter((object): object is THREE.Mesh => object instanceof THREE.Mesh);
  const command = new CommandTestMeshDuplicate(meshes, rig.selection);
  rig.duplicates.push(command);
  rig.commandStack.push(command);
}

/**
 * Moves the pointer over a world point.
 *
 * @param rig Test rig.
 * @param session Running session.
 * @param pointerWorld World point under the pointer.
 * @param keys Held modifier keys.
 * @param keys.shiftKey True while Shift is held.
 * @param keys.altKey True while Alt is held.
 */
function movePointer(
  rig: MoveTestRig,
  session: ObjectDragMoveSession,
  pointerWorld: THREE.Vector3,
  keys: { shiftKey?: boolean; altKey?: boolean } = {},
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
 * Rounds every component of a vector to grid steps.
 *
 * @param vector Unsnapped vector.
 * @param step Grid step.
 * @returns New snapped vector.
 */
function vectorSnapped(vector: THREE.Vector3, step: number): THREE.Vector3 {
  return new THREE.Vector3(
    Math.round(vector.x / step),
    Math.round(vector.y / step),
    Math.round(vector.z / step),
  ).multiplyScalar(step);
}

/**
 * Returns a point on the top face of the rig mesh, away from its center.
 *
 * @param rig Test rig.
 * @returns World point on the top face.
 */
function meshTopPoint(rig: MoveTestRig): THREE.Vector3 {
  const bounds = new THREE.Box3().setFromObject(rig.mesh);
  const center = bounds.getCenter(new THREE.Vector3());
  return new THREE.Vector3(center.x + 0.3, bounds.max.y, center.z - 0.2);
}

/**
 * Proves dragging a selected object moves the selection: on the grid plane in
 * perspective, vertically with Alt without a jump, in the view plane in 2D,
 * snapped unless Shift is held, duplicated first with Ctrl as one undo entry,
 * and fully restored on cancel.
 */
describe('ObjectDragMoveSession', () => {
  const horizontalOffset = new THREE.Vector3(1.3, 0, -0.8);

  it('moves the selection on the horizontal plane through the pressed point, snapped to the grid', () => {
    const rig = moveRigCreate(ViewportKind.PERSPECTIVE);
    const start = rig.mesh.position.clone();
    const pressPoint = meshTopPoint(rig);
    const session = moveSessionStart(rig, pressPoint);
    movePointer(rig, session, pressPoint.clone().add(horizontalOffset));
    session.commit();
    const expected = start.clone().add(vectorSnapped(horizontalOffset, rig.gridSnap.getInterval()));
    expect(rig.mesh.position.distanceTo(expected)).toBeLessThan(1e-6);
    expect(rig.commandStack.getUndoCount()).toBe(1);
    expect(rig.counters.afterCommit).toBe(1);
    rig.commandStack.undo();
    expect(rig.mesh.position.distanceTo(start)).toBeLessThan(1e-9);
  });

  it('follows the pointer exactly while Shift is held and restores snapping afterwards', () => {
    const rig = moveRigCreate(ViewportKind.PERSPECTIVE);
    const start = rig.mesh.position.clone();
    const pressPoint = meshTopPoint(rig);
    const session = moveSessionStart(rig, pressPoint);
    movePointer(rig, session, pressPoint.clone().add(horizontalOffset), { shiftKey: true });
    expect(rig.mesh.position.distanceTo(start.clone().add(horizontalOffset))).toBeLessThan(1e-4);
    session.commit();
    expect(rig.gridSnap.isEnabled()).toBe(true);
  });

  it('switches to vertical movement with Alt without jumping, then moves along the grid normal', () => {
    const rig = moveRigCreate(ViewportKind.PERSPECTIVE);
    const step = rig.gridSnap.getInterval();
    const pressPoint = meshTopPoint(rig);
    const session = moveSessionStart(rig, pressPoint);
    const pointerOnPlane = pressPoint.clone().add(horizontalOffset);
    movePointer(rig, session, pointerOnPlane);
    const positionBeforeAlt = rig.mesh.position.clone();
    movePointer(rig, session, pointerOnPlane, { altKey: true });
    expect(rig.mesh.position.distanceTo(positionBeforeAlt)).toBeLessThan(1e-6);
    const rise = 4 * step;
    const lineBase = pressPoint.clone().add(vectorSnapped(horizontalOffset, step));
    movePointer(rig, session, lineBase.clone().add(new THREE.Vector3(0, rise, 0)), { altKey: true });
    expect(rig.mesh.position.x).toBeCloseTo(positionBeforeAlt.x, 6);
    expect(rig.mesh.position.z).toBeCloseTo(positionBeforeAlt.z, 6);
    expect(rig.mesh.position.y - positionBeforeAlt.y).toBeCloseTo(rise, 6);
    session.cancel();
  });

  it('moves in the view plane in a 2D view', () => {
    const rig = moveRigCreate(ViewportKind.TOP);
    const start = rig.mesh.position.clone();
    const pressPoint = rig.mesh.position.clone();
    const session = moveSessionStart(rig, pressPoint);
    movePointer(rig, session, pressPoint.clone().add(horizontalOffset));
    session.commit();
    const expected = start.clone().add(vectorSnapped(horizontalOffset, rig.gridSnap.getInterval()));
    expect(rig.mesh.position.distanceTo(expected)).toBeLessThan(1e-6);
  });

  it('duplicates first with Ctrl and records duplicate plus move as one undo entry', () => {
    const rig = moveRigCreate(ViewportKind.PERSPECTIVE);
    const original = rig.mesh;
    const start = original.position.clone();
    const pressPoint = meshTopPoint(rig);
    const session = moveSessionStart(rig, pressPoint, { duplicate: true });
    movePointer(rig, session, pressPoint.clone().add(horizontalOffset));
    session.commit();
    const copy = rig.duplicates[0]?.copies[0];
    expect(copy?.parent).toBe(rig.world);
    expect(original.position.distanceTo(start)).toBeLessThan(1e-9);
    const expected = start.clone().add(vectorSnapped(horizontalOffset, rig.gridSnap.getInterval()));
    expect(copy?.position.distanceTo(expected)).toBeLessThan(1e-6);
    expect(rig.selection.getAllSelectedObjectsAsArray()).toEqual([copy]);
    expect(rig.commandStack.getUndoCount()).toBe(1);
    rig.commandStack.undo();
    expect(copy?.parent).toBeNull();
    expect(rig.commandStack.canUndo()).toBe(false);
  });

  it('puts everything back on cancel, removing duplicates and restoring the selection', () => {
    const rig = moveRigCreate(ViewportKind.PERSPECTIVE);
    const start = rig.mesh.position.clone();
    const pressPoint = meshTopPoint(rig);
    const session = moveSessionStart(rig, pressPoint, { duplicate: true });
    movePointer(rig, session, pressPoint.clone().add(horizontalOffset));
    session.cancel();
    expect(rig.duplicates[0]?.copies[0]?.parent).toBeNull();
    expect(rig.mesh.position.distanceTo(start)).toBeLessThan(1e-9);
    expect(rig.selection.getAllSelectedObjectsAsArray()).toEqual([rig.mesh]);
    expect(rig.commandStack.canUndo()).toBe(false);
    expect(rig.commandStack.canRedo()).toBe(false);
    expect(rig.counters.afterCancel).toBe(1);
  });
});
