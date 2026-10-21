import type * as THREE from 'three';
import type { CommandStack } from '@/commands/command_stack.js';
import type { EntityHandleSnap } from '@/entity/handles/entity_handle.js';
import { EntityHandleDragSession } from '@/entity/handles/entity_handle_drag_session.js';
import { EntityHandleOverlay } from '@/entity/handles/entity_handle_overlay.js';
import {
  type EntityHandlePane,
  type EntityHandlePointer,
  entityHandlePickAt,
  entityHandleRayAt,
} from '@/entity/handles/entity_handle_picker.js';
import { entityHandleTargetsOf } from '@/entity/handles/entity_handle_targets.js';
import { WindowPointerDragSession } from '@/utils/session_window_pointer_drag.js';

/** Selection the handle system follows. */
export interface EntityHandleSelectionSource {
  /**
   * Returns the selected objects.
   *
   * @returns Selected objects.
   */
  getSelectedObjects(): Iterable<THREE.Object3D>;

  /**
   * Registers a callback run after every selection change.
   *
   * @param callback Change callback.
   */
  onSelectionChanged(callback: () => void): void;
}

/** Objects the handle system works with. */
export interface EntityHandleSystemDependencies {
  /** Editor world root; the balls are drawn beside it. */
  worldObject: THREE.Object3D;
  /** Selection whose entities show handles. */
  selection: EntityHandleSelectionSource;
  /** Undo stack that receives finished drags. */
  commandStack: CommandStack;
  /** Snapping applied while dragging. */
  snap: EntityHandleSnap;
}

/** Pane and callbacks of the drag in progress. */
interface EntityHandleSystemDrag {
  readonly pane: EntityHandlePane;
  readonly ownerWindow: Window;
  readonly onEnded: () => void;
  readonly onKeyDown: (event: KeyboardEvent) => void;
}

/**
 * Shows the handles of the selected entities and drags them with the mouse: the
 * drag follows the pointer anywhere in the window, Escape cancels it and
 * release leaves one undo step.
 */
export class EntityHandleSystem {
  readonly overlay: EntityHandleOverlay;
  readonly session: EntityHandleDragSession;
  private readonly dependencies: EntityHandleSystemDependencies;
  private readonly windowDrag: WindowPointerDragSession;
  private drag: EntityHandleSystemDrag | null = null;

  /**
   * Creates the system and follows selection and undo changes.
   *
   * @param dependencies World, selection, undo stack and snapping.
   */
  constructor(dependencies: EntityHandleSystemDependencies) {
    this.dependencies = dependencies;
    this.overlay = new EntityHandleOverlay();
    this.session = new EntityHandleDragSession(dependencies.commandStack, dependencies.snap);
    this.windowDrag = new WindowPointerDragSession();
    dependencies.selection.onSelectionChanged(() => this.refresh());
    dependencies.commandStack.onStackChanged(() => this.refresh());
  }

  /** Shows one ball per handle of the selected, unlocked entities. */
  refresh(): void {
    this.overlay.attachBeside(this.dependencies.worldObject);
    this.overlay.targetsSet(entityHandleTargetsOf([...this.dependencies.selection.getSelectedObjects()]));
  }

  /**
   * Returns whether a handle is under the pointer.
   *
   * @param pointer Pointer in a pane.
   * @returns True when a press there would grab a handle.
   */
  probe(pointer: EntityHandlePointer): boolean {
    return entityHandlePickAt(this.overlay.targets(), pointer) !== null;
  }

  /**
   * Returns whether a handle drag is in progress.
   *
   * @returns True while dragging.
   */
  isDragging(): boolean {
    return this.drag !== null;
  }

  /**
   * Starts dragging the handle under the pointer and follows the pointer in its
   * window until release or Escape.
   *
   * @param pointer Press in a pane.
   * @param ownerWindow Window that owns the pane.
   * @param onEnded Runs once when the drag ends or is cancelled.
   * @returns True when a handle was grabbed.
   */
  dragBegin(pointer: EntityHandlePointer, ownerWindow: Window, onEnded: () => void): boolean {
    const target = entityHandlePickAt(this.overlay.targets(), pointer);
    if (!target || !this.session.begin(target, pointer.camera, entityHandleRayAt(pointer))) {
      return false;
    }
    const onKeyDown = (event: KeyboardEvent): void => this.dragKeyDown(event);
    this.drag = { pane: { camera: pointer.camera, element: pointer.element }, ownerWindow, onEnded, onKeyDown };
    ownerWindow.addEventListener('keydown', onKeyDown, true);
    this.windowDrag.begin(
      (event) => this.dragMove(event),
      () => this.dragFinish(false),
      ownerWindow,
      EntityHandleSystem.pointerCaptureOf(pointer),
    );
    return true;
  }

  /** Abandons a drag in progress and restores the dragged entity. */
  dragCancel(): void {
    if (this.drag) {
      this.windowDrag.end();
      this.dragFinish(true);
    }
  }

  /**
   * Moves the dragged handle under the pointer.
   *
   * @param event Pointer move anywhere in the window.
   */
  private dragMove(event: MouseEvent): void {
    if (this.drag) {
      this.session.move(entityHandleRayAt({ ...this.drag.pane, event }));
    }
  }

  /**
   * Cancels the drag when Escape is pressed.
   *
   * @param event Key press during the drag.
   */
  private dragKeyDown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.dragCancel();
  }

  /**
   * Ends the drag, keeping or undoing its result, and releases its listeners.
   *
   * @param isCancelled True to restore the starting settings.
   */
  private dragFinish(isCancelled: boolean): void {
    const drag = this.drag;
    this.drag = null;
    if (!drag) {
      return;
    }
    drag.ownerWindow.removeEventListener('keydown', drag.onKeyDown, true);
    if (isCancelled) {
      this.session.cancel();
    } else {
      this.session.end();
    }
    drag.onEnded();
  }

  /**
   * Returns the pointer capture of a press, when it carries a pointer id.
   *
   * @param pointer Press in a pane.
   * @returns Element and pointer id, or null.
   */
  private static pointerCaptureOf(pointer: EntityHandlePointer): { element: HTMLElement; pointerId: number } | null {
    const pointerId = (pointer.event as Partial<PointerEvent>).pointerId;
    return typeof pointerId === 'number' ? { element: pointer.element, pointerId } : null;
  }
}
