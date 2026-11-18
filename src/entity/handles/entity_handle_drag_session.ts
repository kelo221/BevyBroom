import * as THREE from 'three';
import type { CommandStack } from '@/commands/command_stack.js';
import { CommandEntitySettingsSet } from '@/entity/commands/command_entity_settings_set.js';
import { EntityHandle, type EntityHandleSnap, type EntityHandleView } from '@/entity/handles/entity_handle.js';
import type { EntityOwner } from '@/entity/model/entity_owner.js';
import { entityHandleAxisDragPlane, entityHandleAxisPointOf } from '@/entity/handles/entity_handle_axis.js';

/** One handle of one entity owner. */
export interface EntityHandleTarget {
  /** Entity owner group the handle belongs to. */
  owner: THREE.Object3D;
  /** Owner helper of the owner's kind. */
  entityOwner: EntityOwner<object>;
  /** The handle being dragged. */
  handle: EntityHandle<object>;
}

/** Line an arrow drag keeps the handle on. */
interface EntityHandleAxisLine {
  /** Handle position when the drag began, in world space. */
  readonly origin: THREE.Vector3;
  /** Unit world direction of the grabbed arrow. */
  readonly axis: THREE.Vector3;
}

/** State of the drag in progress. */
interface EntityHandleDragState {
  readonly target: EntityHandleTarget;
  readonly view: EntityHandleView;
  readonly settingsAtStart: object;
  readonly plane: THREE.Plane;
  readonly grabOffset: THREE.Vector3;
  readonly axisLine: EntityHandleAxisLine | null;
  hasMoved: boolean;
}

/**
 * Drags one entity handle with pointer rays: writes the owner's settings live
 * while the pointer moves and leaves one undo step when the drag ends.
 */
export class EntityHandleDragSession {
  private readonly commandStack: CommandStack;
  private readonly snap: EntityHandleSnap;
  private drag: EntityHandleDragState | null = null;

  /**
   * Creates an idle drag session.
   *
   * @param commandStack Undo stack that receives the finished drag.
   * @param snap Snapping applied to dragged values.
   */
  constructor(commandStack: CommandStack, snap: EntityHandleSnap) {
    this.commandStack = commandStack;
    this.snap = snap;
  }

  /**
   * Returns whether a drag is in progress.
   *
   * @returns True between a successful begin and its end or cancel.
   */
  isActive(): boolean {
    return this.drag !== null;
  }

  /**
   * Starts dragging a handle where a pointer ray meets its drag plane. The
   * handle keeps its offset from the pointer, so grabbing it off center does
   * not make it jump. Dragging one of its arrows keeps the handle on the line
   * through its start along that arrow.
   *
   * @param target Handle and owner to drag.
   * @param camera Camera of the pane the drag happens in.
   * @param ray Pointer ray in world space.
   * @param axis Unit world direction of the grabbed arrow, or null for the
   *   ball.
   * @returns True when the drag started.
   */
  begin(target: EntityHandleTarget, camera: THREE.Camera, ray: THREE.Ray, axis: THREE.Vector3 | null = null): boolean {
    const settingsAtStart = target.entityOwner.settingsRead(target.owner);
    if (settingsAtStart === null) {
      return false;
    }
    target.owner.updateWorldMatrix(true, false);
    const view = { owner: target.owner, camera };
    const origin = target.handle.worldPositionFor(view, settingsAtStart);
    const axisLine = axis === null ? null : { origin, axis: axis.clone().normalize() };
    const plane = this.dragPlaneResolve(target, view, settingsAtStart, axisLine);
    const pointer = ray.intersectPlane(plane, new THREE.Vector3());
    if (!pointer) {
      return false;
    }
    const grabOffset = origin.clone().sub(pointer);
    this.drag = { target, view, settingsAtStart, plane, grabOffset, axisLine, hasMoved: false };
    return true;
  }

  /**
   * Returns the plane a drag follows: one holding the arrow line for arrow
   * drags, the handle's own drag plane otherwise.
   *
   * @param target Dragged handle and owner.
   * @param view Owner and camera.
   * @param settings Settings when the drag began.
   * @param axisLine Line of the grabbed arrow, or null.
   * @returns Drag plane.
   */
  private dragPlaneResolve(
    target: EntityHandleTarget,
    view: EntityHandleView,
    settings: object,
    axisLine: EntityHandleAxisLine | null,
  ): THREE.Plane {
    if (axisLine === null) {
      return target.handle.dragPlaneFor(view, settings);
    }
    const viewDirection = EntityHandle.viewDirectionAt(view.camera, axisLine.origin);
    return entityHandleAxisDragPlane(axisLine.origin, axisLine.axis, viewDirection);
  }

  /**
   * Moves the dragged handle to where a pointer ray meets its drag plane and
   * writes the resulting settings to the owner.
   *
   * @param ray Pointer ray in world space.
   * @returns True when the settings were written.
   */
  move(ray: THREE.Ray): boolean {
    const drag = this.drag;
    const pointer = drag ? ray.intersectPlane(drag.plane, new THREE.Vector3()) : null;
    if (!drag || !pointer) {
      return false;
    }
    const freeWorld = pointer.add(drag.grabOffset);
    const handleWorld = drag.axisLine
      ? entityHandleAxisPointOf(drag.axisLine.origin, drag.axisLine.axis, freeWorld)
      : freeWorld;
    const { target, view, settingsAtStart } = drag;
    target.entityOwner.settingsWrite(
      target.owner,
      target.handle.settingsDragged(view, settingsAtStart, handleWorld, this.snap),
    );
    drag.hasMoved = true;
    return true;
  }

  /**
   * Finishes the drag. A drag that moved restores the starting settings and
   * pushes one undo step that applies the final ones.
   */
  end(): void {
    const drag = this.drag;
    this.drag = null;
    if (!drag || !drag.hasMoved) {
      return;
    }
    const { entityOwner, owner } = drag.target;
    const finalSettings = entityOwner.settingsRead(owner) ?? drag.settingsAtStart;
    entityOwner.settingsWrite(owner, drag.settingsAtStart);
    this.commandStack.push(new CommandEntitySettingsSet(entityOwner, [owner], () => finalSettings));
  }

  /** Abandons the drag and restores the starting settings. */
  cancel(): void {
    const drag = this.drag;
    this.drag = null;
    if (drag?.hasMoved) {
      drag.target.entityOwner.settingsWrite(drag.target.owner, drag.settingsAtStart);
    }
  }
}
