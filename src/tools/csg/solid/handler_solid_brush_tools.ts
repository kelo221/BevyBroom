import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import type { FaceSelection } from '@/selection/face/manager_face_selection.js';
import type { GridSnap } from '@/transform/snap/grid_snap.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import {
  CommandSolidBrushesSnapVertices,
  type SnapVerticesStep,
} from '@/solid/commands/brushes/command_solid_brushes_snap_vertices.js';
import {
  CommandSolidBrushesGeometryEdit,
  type SolidBrushGeometryEditResult,
} from '@/solid/commands/brushes/command_solid_brushes_geometry_edit.js';
import {
  CommandSolidBrushesVertexMatrix,
  solidBrushVertexMatrixEntriesBuild,
} from '@/solid/commands/brushes/command_solid_brushes_vertex_matrix.js';
import { solidBrushesWorldVertexBounds } from '@/solid/model/solid_brush_world_bounds.js';
import { shearMatrixFromWorldBox, type ShearAxisName } from '@/transform/shear/shear_matrix.js';
import { solidBrushHullSelection } from '@/tools/hull/handler_solid_brush_hull.js';
import { HandlerSolidHollow } from '@/tools/csg/solid/hollow/handler_solid_hollow.js';
import { HandlerSolidConvexMerge } from '@/tools/csg/solid/merge/handler_solid_convex_merge.js';
import { convexMergeFacePicksFromSelection } from '@/tools/csg/solid/merge/convex_merge_face_selection.js';
import { HandlerFlipSelection, type FlipSelectionResult } from '@/transform/flip/handler_flip_selection.js';
import {
  flipCameraRightRead,
  flipHorizontalAxisForCamera,
  type FlipAxis,
  type FlipHorizontalAxis,
} from '@/transform/flip/flip_axis.js';

/** Direction a flip mirrors the selection in, relative to the active view. */
export type SolidBrushFlipDirection = 'horizontal' | 'vertical';

/** Editor services the brush tools act on. */
export interface HandlerSolidBrushToolsDeps {
  /** Undo stack receiving one entry per tool run. */
  commandStack: CommandStack;
  /** Grid size and snapping source. */
  gridSnap: GridSnap;
  /**
   * Returns the selected objects.
   *
   * @returns Selected objects in selection order.
   */
  selectedObjectsRead: () => readonly THREE.Object3D[];
  /**
   * Returns the selected brush faces while face mode is active.
   *
   * @returns Selected faces, empty outside face mode.
   */
  selectedFacesRead: () => readonly FaceSelection[];
  /**
   * Returns the camera of the active view, used to pick the horizontal axis.
   *
   * @returns Active camera, or null when no view is active.
   */
  activeCameraRead: () => THREE.Camera | null;
  /**
   * Returns whether texture position lock keeps faces aligned.
   *
   * @returns True while position lock is on.
   */
  isTexturePositionLockEnabled: () => boolean;
  /**
   * Shows a status line message.
   *
   * @param message Message text.
   */
  showStatusMessage: (message: string) => void;
  /**
   * Replaces the object selection after a tool created new brushes.
   *
   * @param meshes Meshes to select.
   */
  selectionReplace: (meshes: readonly THREE.Mesh[]) => void;
  /** Refreshes viewports, outliner and panels after the world changed. */
  afterWorldMutation: () => void;
}

/**
 * Entry point for the solid brush editing tools reachable from menus, the
 * toolbar and automation: hollow, convex merge, flip, shear and vertex
 * snapping.
 */
export class HandlerSolidBrushTools {
  private readonly deps: HandlerSolidBrushToolsDeps;

  /**
   * Creates the brush tools entry point.
   *
   * @param deps Editor services the tools act on.
   */
  constructor(deps: HandlerSolidBrushToolsDeps) {
    this.deps = deps;
  }

  /**
   * Replaces each selected brush with grouped walls.
   *
   * @param thickness Wall thickness; the grid size when omitted.
   * @returns Created wall objects, or null when nothing was hollowed.
   */
  hollow(thickness?: number): THREE.Mesh[] | null {
    const created = new HandlerSolidHollow({
      commandStack: this.deps.commandStack,
      getSelectedObjects: () => this.deps.selectedObjectsRead(),
      thicknessRead: () => thickness ?? this.deps.gridSnap.getInterval(),
      showStatusMessage: (message) => this.deps.showStatusMessage(message),
    }).run();
    this.resultSelect(created);
    return created;
  }

  /**
   * Builds one convex brush around the selected faces in face mode, or around
   * the selected brushes otherwise (the brushes are replaced).
   *
   * @returns Created brush, or null when the hull could not be built.
   */
  convexMerge(): SolidBrushInstance | null {
    const merge = new HandlerSolidConvexMerge(this.deps.commandStack, (message) =>
      this.deps.showStatusMessage(message),
    );
    const faces = this.deps.selectedFacesRead();
    const created =
      faces.length > 0
        ? merge.mergeFaces(convexMergeFacePicksFromSelection(faces))
        : merge.mergeBrushes(solidBrushHullSelection(this.deps.selectedObjectsRead()));
    this.resultSelect(created?.mesh ? [created.mesh] : null);
    return created;
  }

  /**
   * Mirrors the selected brushes across the grid-snapped center of their
   * bounds.
   *
   * @param direction Horizontal mirrors along the view's right axis, vertical
   *   along up.
   * @returns Flip result, or null when nothing could flip.
   */
  flip(direction: SolidBrushFlipDirection): FlipSelectionResult | null {
    return this.flipAxis(direction === 'vertical' ? 'y' : this.horizontalAxisRead());
  }

  /**
   * Mirrors the selected brushes across one world axis through the grid-snapped
   * center of their bounds.
   *
   * @param axis World mirror axis.
   * @returns Flip result, or null when nothing could flip.
   */
  flipAxis(axis: FlipAxis): FlipSelectionResult | null {
    const result = new HandlerFlipSelection({
      commandStack: this.deps.commandStack,
      getSelectedObjects: () => this.deps.selectedObjectsRead(),
      gridSnap: this.deps.gridSnap,
      isTexturePositionLockEnabled: () => this.deps.isTexturePositionLockEnabled(),
      showStatusMessage: (message) => this.deps.showStatusMessage(message),
    }).flip(axis);
    this.deps.afterWorldMutation();
    return result;
  }

  /**
   * Shears the selected brushes: the side of their world bounds at the positive
   * end of one axis slides along another axis while the opposite side stays
   * fixed.
   *
   * @param axis Axis whose positive side slides.
   * @param along Axis the side slides along.
   * @param offset Slide distance in world units.
   * @returns Edited and skipped brushes, or null when nothing could shear.
   */
  shear(axis: ShearAxisName, along: ShearAxisName, offset: number): SolidBrushGeometryEditResult | null {
    const brushes = solidBrushHullSelection(this.deps.selectedObjectsRead());
    const bounds = solidBrushesWorldVertexBounds(brushes);
    const matrix = brushes.length > 0 ? shearMatrixFromWorldBox(bounds.min, bounds.max, axis, along, offset) : null;
    if (!matrix) {
      this.deps.showStatusMessage('Shear needs selected solid brushes and two different axes');
      return null;
    }
    const lockTextures = this.deps.isTexturePositionLockEnabled();
    const command = new CommandSolidBrushesVertexMatrix(
      solidBrushVertexMatrixEntriesBuild(brushes, matrix, lockTextures),
    );
    this.deps.commandStack.push(command);
    return this.editResultReport(command, 'Sheared');
  }

  /**
   * Rounds every vertex of the selected brushes to the grid or to whole units.
   *
   * @param step 'grid' rounds to the grid size, 'integer' to whole meters.
   * @returns Edited and skipped brushes, or null when no brush was selected.
   */
  snapVertices(step: SnapVerticesStep): SolidBrushGeometryEditResult | null {
    const brushes = solidBrushHullSelection(this.deps.selectedObjectsRead());
    if (brushes.length === 0) {
      this.deps.showStatusMessage('Snap vertices needs selected solid brushes');
      return null;
    }
    const models = brushes.flatMap((brush) => (brush.mesh ? [SolidModel.fromObject(brush.mesh)] : []));
    const command = new CommandSolidBrushesSnapVertices(
      models.filter((model): model is SolidModel => model !== null),
      brushes,
      step,
      this.deps.gridSnap.getInterval(),
    );
    this.deps.commandStack.push(command);
    return this.editResultReport(command, 'Snapped vertices of');
  }

  /**
   * Reports a geometry edit result and refreshes the editor.
   *
   * @param command Executed geometry edit command.
   * @param verb Leading status words, e.g. 'Sheared'.
   * @returns Edited and skipped brushes.
   */
  private editResultReport(command: CommandSolidBrushesGeometryEdit, verb: string): SolidBrushGeometryEditResult {
    const result = command.getEditResult();
    const skippedSuffix = result.skipped.length > 0 ? `, ${result.skipped.length} left unchanged` : '';
    this.deps.showStatusMessage(`${verb} ${result.edited.length} brush(es)${skippedSuffix}`);
    this.deps.afterWorldMutation();
    return result;
  }

  /**
   * Picks the horizontal mirror axis from the active camera, X without one.
   *
   * @returns 'x' or 'z'.
   */
  private horizontalAxisRead(): FlipHorizontalAxis {
    const camera = this.deps.activeCameraRead();
    if (!camera) {
      return 'x';
    }
    return flipHorizontalAxisForCamera(flipCameraRightRead(camera));
  }

  /**
   * Selects the objects a tool created and refreshes the editor.
   *
   * @param created Created objects, or null when the tool did nothing.
   */
  private resultSelect(created: readonly THREE.Mesh[] | null): void {
    if (!created || created.length === 0) {
      return;
    }
    this.deps.selectionReplace(created);
    this.deps.afterWorldMutation();
  }
}
