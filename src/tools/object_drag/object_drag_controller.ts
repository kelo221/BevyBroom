import type * as THREE from 'three';
import type { GridSnap } from '@/transform/snap/grid_snap.js';
import { ObjectDragGridFrame } from './object_drag_grid_frame.js';
import { ObjectDragViewport, type ObjectDragViewportSource } from './object_drag_viewport.js';
import type { ObjectDragSession } from './object_drag_session.js';
import type { ObjectDragPointerSample } from './object_drag_pointer_sample.js';
import {
  ObjectDragMoveSession,
  type ObjectDragMoveSelection,
  type ObjectDragMoveSessionDeps,
} from '@/tools/object_drag_move/object_drag_move_session.js';
import { ShapeDrawSession } from '@/tools/shape_draw/shape_draw_session.js';
import type { ShapeDrawBrushCommit } from '@/tools/shape_draw/shape_draw_brush_commit.js';
import type { ShapeDrawPreviewHost } from '@/tools/shape_draw/shape_draw_preview.js';
import type { ShapeDrawSettings } from '@/tools/shape_draw/shapes/shape_draw_settings.js';
import {
  ShapeDrawReferenceBoundsTracker,
  type ShapeDrawReferenceSelectionSource,
} from '@/tools/shape_draw/shape_draw_reference_bounds.js';

/** Selection members the drag controller needs. */
export interface ObjectDragControllerSelection extends ObjectDragMoveSelection, ShapeDrawReferenceSelectionSource {
  isObjectSelected(mesh: THREE.Mesh): boolean;
  getSelectedObjectCount(): number;
}

/** Move-session systems the controller passes through unchanged. */
export type ObjectDragControllerMoveDeps = Omit<
  ObjectDragMoveSessionDeps,
  'viewport' | 'gridFrame' | 'gridSnap' | 'userSnapEnabledRead' | 'selection'
>;

/** Editor systems the drag controller works with. */
export interface ObjectDragControllerDeps {
  /**
   * Finds the interactive viewport under a client point.
   *
   * @param clientX Client X.
   * @param clientY Client Y.
   * @returns Viewport, or null when the point is outside every pane.
   */
  viewportAtClientPoint: (clientX: number, clientY: number) => ObjectDragViewportSource | null;
  /** Shared grid snap and working grid frame. */
  gridSnap: GridSnap;
  /**
   * Returns the user's grid snap preference.
   *
   * @returns True when snapping is wanted.
   */
  userSnapEnabledRead: () => boolean;
  /**
   * Returns whether object editing drags are allowed right now.
   *
   * @returns False while another mode (such as Edit Mode) owns the mouse.
   */
  objectEditingAllowed: () => boolean;
  /** Selection state. */
  selection: ObjectDragControllerSelection;
  /** Systems for selection moves. */
  move: ObjectDragControllerMoveDeps;
  /** Commits drawn boxes as brushes. */
  brushCommit: ShapeDrawBrushCommit;
  /** Helper scene for the draw preview. */
  previewHost: ShapeDrawPreviewHost;
  /** Shape and parameter selection draws use. */
  shapeSettings: ShapeDrawSettings;
}

/**
 * Decides what a mouse drag in a viewport does: dragging a selected object
 * moves the selection (Ctrl duplicates first), dragging anywhere while nothing
 * is selected draws a new box brush, anything else does nothing.
 */
export class ObjectDragController {
  private readonly deps: ObjectDragControllerDeps;
  private readonly gridFrame: ObjectDragGridFrame;
  private readonly referenceBounds: ShapeDrawReferenceBoundsTracker;

  /**
   * Creates the drag controller and starts tracking reference bounds.
   *
   * @param deps Editor systems.
   */
  constructor(deps: ObjectDragControllerDeps) {
    this.deps = deps;
    this.gridFrame = new ObjectDragGridFrame(deps.gridSnap);
    this.referenceBounds = new ShapeDrawReferenceBoundsTracker(deps.selection);
  }

  /**
   * Starts the drag session a press implies.
   *
   * @param press Press position and the modifier keys held at the press.
   * @returns Running session, or null when the drag does nothing.
   */
  dragBegin(press: ObjectDragPointerSample): ObjectDragSession | null {
    if (!this.deps.objectEditingAllowed()) {
      return null;
    }
    const source = this.deps.viewportAtClientPoint(press.clientX, press.clientY);
    if (!source) {
      return null;
    }
    const viewport = new ObjectDragViewport(source);
    const pressedMesh = this.pressedSelectedMeshFind(viewport, press);
    if (pressedMesh) {
      return this.moveSessionBegin(viewport, press, pressedMesh);
    }
    if (this.selectionIsEmpty() && !press.ctrlKey) {
      return this.drawSessionBegin(viewport, press);
    }
    return null;
  }

  /** Stops tracking the selection. */
  dispose(): void {
    this.referenceBounds.dispose();
  }

  /**
   * Finds the first mesh under the press that is selected or lies under a
   * selected transform target.
   *
   * @param viewport Viewport under the press.
   * @param press Press sample.
   * @returns Pressed selected mesh, or null.
   */
  private pressedSelectedMeshFind(viewport: ObjectDragViewport, press: ObjectDragPointerSample): THREE.Mesh | null {
    const stack = viewport.pickStackAtClientPoint(press.clientX, press.clientY);
    if (stack.length === 0) {
      return null;
    }
    const targets = new Set<THREE.Object3D>(this.deps.move.transformTargetsResolve());
    for (const mesh of stack) {
      if (this.deps.selection.isObjectSelected(mesh) || this.objectOrAncestorIn(mesh, targets)) {
        return mesh;
      }
    }
    return null;
  }

  /**
   * Returns whether an object or one of its ancestors is in a set.
   *
   * @param object Object to test.
   * @param objects Set of objects.
   * @returns True when the object or an ancestor is contained.
   */
  private objectOrAncestorIn(object: THREE.Object3D, objects: ReadonlySet<THREE.Object3D>): boolean {
    let current: THREE.Object3D | null = object;
    while (current) {
      if (objects.has(current)) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  /**
   * Returns whether nothing is selected.
   *
   * @returns True with no selected meshes and no selected hierarchy objects.
   */
  private selectionIsEmpty(): boolean {
    return this.deps.selection.getSelectedObjectCount() === 0 && this.deps.selection.getInspectorObjects().length === 0;
  }

  /**
   * Starts a selection move.
   *
   * @param viewport Viewport under the press.
   * @param press Press sample.
   * @param pressedMesh Selected mesh under the press.
   * @returns Move session.
   */
  private moveSessionBegin(
    viewport: ObjectDragViewport,
    press: ObjectDragPointerSample,
    pressedMesh: THREE.Mesh,
  ): ObjectDragMoveSession {
    const sessionDeps: ObjectDragMoveSessionDeps = {
      ...this.deps.move,
      viewport,
      gridFrame: this.gridFrame,
      gridSnap: this.deps.gridSnap,
      userSnapEnabledRead: this.deps.userSnapEnabledRead,
      selection: this.deps.selection,
    };
    return new ObjectDragMoveSession(sessionDeps, {
      pressClientX: press.clientX,
      pressClientY: press.clientY,
      pressedMesh,
      duplicate: press.ctrlKey,
      altKey: press.altKey,
    });
  }

  /**
   * Starts drawing a new box brush.
   *
   * @param viewport Viewport under the press.
   * @param press Press sample.
   * @returns Draw session.
   */
  private drawSessionBegin(viewport: ObjectDragViewport, press: ObjectDragPointerSample): ShapeDrawSession {
    return new ShapeDrawSession(
      {
        viewport,
        gridFrame: this.gridFrame,
        snapEnabledRead: this.deps.userSnapEnabledRead,
        referenceBoundsResolve: () => this.referenceBounds.referenceBoundsResolve(),
        previewHost: this.deps.previewHost,
        brushCommit: this.deps.brushCommit,
        shapeSettings: this.deps.shapeSettings,
      },
      press.clientX,
      press.clientY,
    );
  }
}
