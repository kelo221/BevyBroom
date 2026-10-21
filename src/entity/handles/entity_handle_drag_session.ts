import * as THREE from 'three';
import type { CommandStack } from '@/commands/command_stack.js';
import { CommandEntitySettingsSet } from '@/entity/commands/command_entity_settings_set.js';
import type { EntityHandle, EntityHandleSnap, EntityHandleView } from '@/entity/handles/entity_handle.js';
import type { EntityOwner } from '@/entity/model/entity_owner.js';

/** One handle of one entity owner. */
export interface EntityHandleTarget {
  /** Entity owner group the handle belongs to. */
  owner: THREE.Object3D;
  /** Owner helper of the owner's kind. */
  entityOwner: EntityOwner<object>;
  /** The handle being dragged. */
  handle: EntityHandle<object>;
}

/** State of the drag in progress. */
interface EntityHandleDragState {
  readonly target: EntityHandleTarget;
  readonly view: EntityHandleView;
  readonly settingsAtStart: object;
  readonly plane: THREE.Plane;
  readonly grabOffset: THREE.Vector3;
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
   * not make it jump.
   *
   * @param target Handle and owner to drag.
   * @param camera Camera of the pane the drag happens in.
   * @param ray Pointer ray in world space.
   * @returns True when the drag started.
   */
  begin(target: EntityHandleTarget, camera: THREE.Camera, ray: THREE.Ray): boolean {
    const settingsAtStart = target.entityOwner.settingsRead(target.owner);
    if (settingsAtStart === null) {
      return false;
    }
    target.owner.updateWorldMatrix(true, false);
    const view = { owner: target.owner, camera };
    const plane = target.handle.dragPlaneFor(view, settingsAtStart);
    const pointer = ray.intersectPlane(plane, new THREE.Vector3());
    if (!pointer) {
      return false;
    }
    const grabOffset = target.handle.worldPositionFor(view, settingsAtStart).sub(pointer);
    this.drag = { target, view, settingsAtStart, plane, grabOffset, hasMoved: false };
    return true;
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
    const handleWorld = pointer.add(drag.grabOffset);
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
