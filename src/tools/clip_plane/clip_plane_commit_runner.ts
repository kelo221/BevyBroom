import * as THREE from 'three';
import { CommandStack } from '@/commands/command_stack.js';
import { CommandMeshClip } from '@/tools/clip_plane/commands/command_mesh_clip.js';
import { CommandMeshSplit } from '@/tools/clip_plane/commands/command_mesh_split.js';
import { CommandSolidBrushClip } from '@/solid/commands/brush/command_solid_brush_clip.js';
import { CommandSolidBrushSplit } from '@/solid/commands/brush/command_solid_brush_split.js';
import { CsgPlaneSplit } from '@/csg/csg_plane_split.js';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { SolidBrushVisual } from '@/solid/model/solid_brush_visual.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import type { RegistryModalToolSession } from '@/tools/session/registry_modal_tool_session.js';
import { ToolClipPlane } from './tool_clip_plane.js';
import { ClipKeepMode, clipKeepModeKeepsFront } from './clip_keep_mode.js';

/** Dependencies for applying a clip plane to the selection. */
export interface ClipPlaneCommitRunnerDependencies {
  worldObject: THREE.Group;
  commandStack: CommandStack;
  selectionManager: ManagerSelection;
  clipPlaneTool: ToolClipPlane;
  modalToolSessionRegistry: RegistryModalToolSession;
  showStatusMessage: (message: string) => void;
  syncPrimitivesToViewports: () => void;
  refreshOutliner: () => void;
  updateShadingMeshes: () => void;
}

/**
 * Applies a clip plane to every selected mesh and solid brush: keeping one side
 * clips, keeping both splits. Each change is one undoable command.
 */
export class ClipPlaneCommitRunner {
  private readonly deps: ClipPlaneCommitRunnerDependencies;
  private readonly planeSplit: CsgPlaneSplit;

  /**
   * Creates a commit runner.
   *
   * @param deps Shared editor systems.
   */
  constructor(deps: ClipPlaneCommitRunnerDependencies) {
    this.deps = deps;
    this.planeSplit = new CsgPlaneSplit();
  }

  /**
   * Cuts every selected target with the plane and keeps the pieces the mode
   * asks for, then selects the results and resets placement for another cut.
   *
   * @param plane World clip plane.
   * @param mode Which pieces to keep.
   */
  apply(plane: THREE.Plane, mode: ClipKeepMode): void {
    const targets = this.requireTargets();
    if (!targets) return;
    const results: THREE.Mesh[] = [];
    let changedCount = 0;
    targets.forEach((mesh) => {
      changedCount += this.applyToTarget(mesh, plane, mode, results) ? 1 : 0;
    });
    this.finishCommit(results, changedCount, targets.length, mode === ClipKeepMode.BOTH ? 'Split' : 'Clipped');
  }

  /**
   * Cuts one target according to the keep mode.
   *
   * @param mesh Selected mesh target.
   * @param plane Clip plane.
   * @param mode Which pieces to keep.
   * @param results Accumulator for result meshes.
   * @returns True when the target changed.
   */
  private applyToTarget(mesh: THREE.Mesh, plane: THREE.Plane, mode: ClipKeepMode, results: THREE.Mesh[]): boolean {
    if (mode === ClipKeepMode.BOTH) return this.splitOneTarget(mesh, plane, results);
    return this.clipOneTarget(mesh, plane, clipKeepModeKeepsFront(mode), results);
  }

  /**
   * Clips one mesh or solid brush into the keep half-space.
   *
   * @param mesh Selected mesh target.
   * @param plane Clip plane.
   * @param keepFront Whether to keep the front half-space.
   * @param results Accumulator for result meshes.
   * @returns True when a clip was applied.
   */
  private clipOneTarget(mesh: THREE.Mesh, plane: THREE.Plane, keepFront: boolean, results: THREE.Mesh[]): boolean {
    const brushResult = this.clipSolidBrushTarget(mesh, plane, keepFront);
    if (brushResult) {
      results.push(brushResult);
      return true;
    }
    if (SolidBrushVisual.isBrushObject(mesh)) return false;
    const result = this.planeSplit.clipMeshToPlane(mesh, plane, keepFront);
    if (!result) return false;
    this.deps.commandStack.push(new CommandMeshClip(mesh, result, this.deps.worldObject));
    results.push(result);
    return true;
  }

  /**
   * Splits one mesh or solid brush into two halves.
   *
   * @param mesh Selected mesh target.
   * @param plane Split plane.
   * @param results Accumulator for result meshes.
   * @returns True when a split was applied.
   */
  private splitOneTarget(mesh: THREE.Mesh, plane: THREE.Plane, results: THREE.Mesh[]): boolean {
    const brushResults = this.splitSolidBrushTarget(mesh, plane);
    if (brushResults) {
      results.push(...brushResults);
      return true;
    }
    if (SolidBrushVisual.isBrushObject(mesh)) return false;
    const split = this.planeSplit.splitMeshByPlane(mesh, plane);
    if (!split) return false;
    this.deps.commandStack.push(new CommandMeshSplit(mesh, split.frontMesh, split.backMesh, this.deps.worldObject));
    results.push(split.frontMesh, split.backMesh);
    return true;
  }

  /**
   * Clips a solid brush target when the mesh belongs to a solid model.
   *
   * @param mesh Selected mesh.
   * @param plane World clip plane.
   * @param keepFront Keep front half-space.
   * @returns Updated brush mesh, or null when not a brush / clip failed.
   */
  private clipSolidBrushTarget(mesh: THREE.Mesh, plane: THREE.Plane, keepFront: boolean): THREE.Mesh | null {
    if (!SolidBrushVisual.isBrushObject(mesh)) return null;
    const model = SolidModel.fromObject(mesh);
    const brush = model?.findBrushByMesh(mesh);
    if (!model || !brush) return null;
    const command = new CommandSolidBrushClip(model, brush.id, plane, keepFront);
    command.execute();
    if (!command.didClip()) return null;
    this.deps.commandStack.recordExecuted(command);
    const updated = model.findBrush(brush.id);
    return updated?.mesh ?? null;
  }

  /**
   * Splits a solid brush target into two brush pieces.
   *
   * @param mesh Selected mesh.
   * @param plane World split plane.
   * @returns Result meshes, or null when not a brush / split failed.
   */
  private splitSolidBrushTarget(mesh: THREE.Mesh, plane: THREE.Plane): THREE.Mesh[] | null {
    if (!SolidBrushVisual.isBrushObject(mesh)) return null;
    const model = SolidModel.fromObject(mesh);
    const brush = model?.findBrushByMesh(mesh);
    if (!model || !brush) return null;
    const command = new CommandSolidBrushSplit(model, brush.id, plane);
    command.execute();
    if (!command.didSplit()) return null;
    this.deps.commandStack.recordExecuted(command);
    return command.getResultMeshes();
  }

  /**
   * Returns selected meshes or shows status and null.
   *
   * @returns Selected meshes or null.
   */
  private requireTargets(): THREE.Mesh[] | null {
    const targets = this.deps.selectionManager.getAllSelectedObjectsAsArray();
    if (targets.length === 0) {
      this.deps.showStatusMessage('Select a mesh to clip');
      return null;
    }
    return targets;
  }

  /**
   * Finalizes selection, viewport sync, outliner refresh, shading update, and
   * status after a successful commit batch. Resets plane placement for another
   * cut without deactivating the tool.
   *
   * @param results Created or updated meshes.
   * @param successCount Meshes that produced results.
   * @param totalCount Attempted targets.
   * @param verb Status verb (Clipped / Split).
   */
  private finishCommit(results: THREE.Mesh[], successCount: number, totalCount: number, verb: string): void {
    if (successCount === 0) {
      this.deps.showStatusMessage('Plane does not cut the selection');
      return;
    }
    this.deps.modalToolSessionRegistry.runWithSelectionEndSuppressed(() => {
      this.selectCommitResults(results);
    });
    this.deps.clipPlaneTool.resetPlacementForNextCut();
    this.deps.syncPrimitivesToViewports();
    this.deps.refreshOutliner();
    this.deps.updateShadingMeshes();
    this.deps.showStatusMessage(`${verb} ${successCount}/${totalCount} · place points to cut again`);
  }

  /**
   * Selects the meshes produced by a clip or split commit.
   *
   * @param results Candidate result meshes (nullish entries ignored).
   */
  private selectCommitResults(results: THREE.Mesh[]): void {
    const selectable = results.filter((mesh) => mesh instanceof THREE.Mesh && mesh.parent !== null);
    if (selectable.length === 0) return;
    this.deps.selectionManager.setSelection(selectable);
  }
}
