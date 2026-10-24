import type * as THREE from 'three';
import type { CommandStack } from '@/commands/command_stack.js';
import type { ManagerSelection } from '@/selection/object/manager_selection.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import type { SolidBrushInstance } from '@/solid/model/solid_brush_instance.js';
import { SolidModelRegistry } from '@/solid/model/solid_model_registry.js';
import { CommandTextureSolidFaceAssign } from '@/texture/commands/command_texture_solid_face_assign.js';
import type { SolidFaceTextureTarget } from '@/texture/commands/command_texture_solid_face_edit.js';

/** Brushes a material replacement looks at: every brush or the selected ones. */
export type TextureReplaceScope = 'all' | 'selection';

/** Editor parts the material replacement acts on. */
export interface HandlerTextureReplaceDeps {
  /** Undo stack receiving one entry per replacement. */
  commandStack: CommandStack;
  /** Scene root whose solid models are searched. */
  worldObject: THREE.Object3D;
  /** Object selection limiting the selection scope. */
  selectionManager: ManagerSelection;
  /** Refreshes the views after faces changed material. */
  afterReplace: () => void;
}

/** One brush with the model that owns it. */
interface TextureReplaceBrushEntry {
  model: SolidModel;
  brush: SolidBrushInstance;
}

/** Replaces one material with another on every matching brush face. */
export class HandlerTextureReplace {
  /**
   * Creates the material replacement.
   *
   * @param deps Undo stack, scene root, selection and refresh callback.
   */
  constructor(private readonly deps: HandlerTextureReplaceDeps) {}

  /**
   * Paints every brush face using one material with another as one undo step,
   * keeping each face's UV mapping.
   *
   * @param findTextureId Material to replace.
   * @param replaceTextureId Material painted instead.
   * @param scope Every brush or only the selected ones.
   * @returns Number of repainted faces.
   */
  replace(findTextureId: string, replaceTextureId: string, scope: TextureReplaceScope): number {
    if (findTextureId === replaceTextureId) {
      return 0;
    }
    const targets = this.faceTargetsCollect(this.brushesInScopeCollect(scope), findTextureId);
    if (targets.length === 0) {
      return 0;
    }
    this.deps.commandStack.push(new CommandTextureSolidFaceAssign(targets, replaceTextureId));
    this.deps.afterReplace();
    return targets.length;
  }

  /**
   * Lists the brushes a scope covers.
   *
   * @param scope Every brush or only the selected ones.
   * @returns Brushes with their models.
   */
  private brushesInScopeCollect(scope: TextureReplaceScope): TextureReplaceBrushEntry[] {
    if (scope === 'selection') {
      return this.selectedBrushesCollect();
    }
    return [...SolidModelRegistry.collectUnder(this.deps.worldObject)].flatMap((model) =>
      model.getBrushes().map((brush) => ({ model, brush })),
    );
  }

  /**
   * Lists the selected brushes, counting a selected model result as all of its
   * brushes.
   *
   * @returns Unique brushes with their models.
   */
  private selectedBrushesCollect(): TextureReplaceBrushEntry[] {
    const entriesByBrushId = new Map<string, TextureReplaceBrushEntry>();
    for (const object of this.deps.selectionManager.getAllSelectedObjectsAsArray()) {
      for (const entry of this.objectBrushesRead(object)) {
        entriesByBrushId.set(entry.brush.id, entry);
      }
    }
    return [...entriesByBrushId.values()];
  }

  /**
   * Returns the brushes one selected object stands for.
   *
   * @param object Selected object.
   * @returns Its brush, every brush of its model for a model result, or none.
   */
  private objectBrushesRead(object: THREE.Object3D): TextureReplaceBrushEntry[] {
    const model = SolidModel.fromObject(object);
    if (!model) {
      return [];
    }
    const brush = model.findBrushByMesh(object);
    if (brush) {
      return [{ model, brush }];
    }
    return SolidModel.isResultMesh(object) ? model.getBrushes().map((entry) => ({ model, brush: entry })) : [];
  }

  /**
   * Lists the faces of brushes that use a material.
   *
   * @param entries Brushes to search.
   * @param findTextureId Material to find.
   * @returns Face targets.
   */
  private faceTargetsCollect(
    entries: readonly TextureReplaceBrushEntry[],
    findTextureId: string,
  ): SolidFaceTextureTarget[] {
    return entries.flatMap(({ model, brush }) =>
      brush.brush.faces.flatMap((_face, surfaceIndex) =>
        brush.getSurfaceTextureId(surfaceIndex) === findTextureId ? [{ model, brushId: brush.id, surfaceIndex }] : [],
      ),
    );
  }
}
