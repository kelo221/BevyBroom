import * as THREE from 'three';
import type { CommandStack } from '@/commands/command_stack.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import { CommandShapeDrawGroupRebuild } from './command_shape_draw_group_rebuild.js';
import { solidGroupShapeRecipeRead, type SolidGroupShapeRecipe } from '@/solid/model/solid_group_shape_recipe.js';
import { shapeDrawPiecesFromPointsCreate } from './shape_draw_piece_build.js';
import { getShapeDrawSettings, type ShapeDrawSettings } from './shapes/shape_draw_settings.js';
import { shapeDrawShapeFind } from './shapes/shape_draw_shape_registry.js';
import type { ShapeDrawShapeParameterValues } from './shapes/shape_draw_shape_parameter.js';
import { ShapeDrawSurfaceCarry } from './surface/shape_draw_surface_carry.js';

/** Services the shape group regeneration needs. */
export interface HandlerShapeDrawRegenerateDeps {
  /** Undo stack. */
  commandStack: CommandStack;
  /** Current object selection. */
  getSelectedObjects: () => readonly THREE.Object3D[];
  /** Status line. */
  showStatusMessage: (message: string) => void;
}

/** Rebuilds selected shape groups with the current shape parameters. */
export class HandlerShapeDrawRegenerate {
  private readonly deps: HandlerShapeDrawRegenerateDeps;
  private readonly settings: ShapeDrawSettings;

  /**
   * Creates the regeneration action.
   *
   * @param deps Selection, undo and status systems.
   * @param settings Shape settings the new parameters come from.
   */
  constructor(deps: HandlerShapeDrawRegenerateDeps, settings: ShapeDrawSettings = getShapeDrawSettings()) {
    this.deps = deps;
    this.settings = settings;
  }

  /**
   * Rebuilds every selected group whose shape matches the selected shape.
   *
   * @returns Number of groups rebuilt.
   */
  run(): number {
    const groups = this.selectedShapeGroupsCollect();
    const matching = groups.filter(
      (group) => solidGroupShapeRecipeRead(group)?.shapeId === this.settings.getSelectedShapeId(),
    );
    const parameters = this.settings.parameterValuesRead(this.settings.getSelectedShapeId());
    matching.forEach((group) => this.groupRebuild(group, parameters));
    this.statusReport(matching.length);
    return matching.length;
  }

  /**
   * Rebuilds one shape group with explicit parameter values as one undo step,
   * carrying the face surfaces of its current brushes onto the new ones.
   *
   * @param group Shape draw group.
   * @param parameters Parameter values replacing the stored recipe values.
   * @returns True when the group was rebuilt.
   */
  groupRebuild(group: THREE.Group, parameters: ShapeDrawShapeParameterValues): boolean {
    const metadata = solidGroupShapeRecipeRead(group);
    const model = SolidModel.fromObject(group);
    if (!metadata || !model) {
      return false;
    }
    const nextMetadata = { ...metadata, parameters: { ...parameters } };
    const pieces = this.groupPiecesCreate(group, nextMetadata);
    if (pieces.length === 0) {
      return false;
    }
    const brushes = this.groupBrushesCollect(group);
    const surfaceCarry = ShapeDrawSurfaceCarry.fromBrushes(brushes);
    this.deps.commandStack.push(new CommandShapeDrawGroupRebuild(model, group, brushes, pieces, surfaceCarry, nextMetadata));
    return true;
  }

  /**
   * Lists shape draw groups the selection touches.
   *
   * @returns Unique groups (the selected object itself or its ancestor).
   */
  private selectedShapeGroupsCollect(): THREE.Group[] {
    const groups: THREE.Group[] = [];
    for (const object of this.deps.getSelectedObjects()) {
      const group = shapeDrawGroupAncestorFind(object);
      if (group && !groups.includes(group)) {
        groups.push(group);
      }
    }
    return groups;
  }

  /**
   * Builds the replacement pieces of a group from a recipe, mapped through
   * the group's current transform so a moved group keeps its pieces.
   *
   * @param group Shape draw group.
   * @param metadata Recipe holding the parameter values to build with.
   * @returns Model-local brush pieces.
   */
  private groupPiecesCreate(group: THREE.Group, metadata: SolidGroupShapeRecipe) {
    const shape = shapeDrawShapeFind(metadata.shapeId);
    const groupLocalPieces = shape.piecesCreate({
      bounds: new THREE.Box3(new THREE.Vector3(...metadata.boundsMin), new THREE.Vector3(...metadata.boundsMax)),
      parameters: metadata.parameters,
      upAxis: metadata.upAxis,
    });
    const mapping = this.groupMappingCreate(group);
    return shapeDrawPiecesFromPointsCreate(
      groupLocalPieces.map((points) => points.map((point) => point.applyMatrix4(mapping))),
    );
  }

  /**
   * Builds the mapping from group-local into model-local coordinates.
   *
   * @param group Shape draw group.
   * @returns Mapping matrix and its rotation.
   */
  private groupMappingCreate(group: THREE.Group): THREE.Matrix4 {
    group.updateWorldMatrix(true, false);
    const model = SolidModel.fromObject(group);
    if (!model) {
      return new THREE.Matrix4();
    }
    model.root.updateWorldMatrix(true, false);
    return model.root.matrixWorld.clone().invert().multiply(group.matrixWorld);
  }

  /**
   * Lists the brush instances currently under a group.
   *
   * @param group Shape draw group.
   * @returns Brush instances in sibling order.
   */
  groupBrushesCollect(group: THREE.Group): SolidBrushInstance[] {
    const model = SolidModel.fromObject(group);
    const brushes: SolidBrushInstance[] = [];
    for (const child of group.children) {
      const brush = model?.findBrushByMesh(child);
      if (brush) {
        brushes.push(brush);
      }
    }
    return brushes;
  }

  /**
   * Reports the rebuild result on the status line.
   *
   * @param count Number of groups rebuilt.
   */
  private statusReport(count: number): void {
    if (count > 0) {
      this.deps.showStatusMessage(`Regenerated ${count} shape group(s)`);
    }
  }
}

/**
 * Finds the shape draw group an object belongs to.
 *
 * @param object Selected object.
 * @returns Owning shape draw group, or null.
 */
export function shapeDrawGroupAncestorFind(object: THREE.Object3D): THREE.Group | null {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (current instanceof THREE.Group && solidGroupShapeRecipeRead(current)) {
      return current;
    }
    current = current.parent;
  }
  return null;
}
