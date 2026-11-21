import * as THREE from 'three';
import type { UndoCommand } from '@/commands/command_undo.js';
import type { ClipboardPasteResult, ControllerClipboard } from '@/clipboard/controller/controller_clipboard.js';
import type {
  ClipboardPlacementAim,
  ClipboardPlacementAimOptions,
} from '@/clipboard/placement/clipboard_placement_cursor.js';
import { CommandPrefabEntityTie } from '@/prefab/commands/command_prefab_entity_tie.js';
import { CommandPrefabEntityWorldMove } from '@/prefab/commands/command_prefab_entity_world_move.js';
import { CommandPrefabTemplateAdd } from '@/prefab/commands/command_prefab_template_add.js';
import { CommandPrefabTemplateRemove } from '@/prefab/commands/command_prefab_template_remove.js';
import { CommandPrefabTemplateUpdate } from '@/prefab/commands/command_prefab_template_update.js';
import { PrefabFileCodec } from '@/prefab/payload/prefab_file_codec.js';
import type { PrefabCatalogStore } from '@/prefab/prefab_catalog_store.js';
import { PREFAB_CATEGORY_DEFAULT, type PrefabTemplate } from '@/prefab/prefab_types.js';
import { PrefabEditorPrompts, type PrefabEditorPromptShow } from '@/prefab/actions/prefab_editor_prompts.js';
import type { ProjectDataFileChangeResult } from '@/project/data/project_data_file_types.js';
import { OutlinerNamingGroupComposition } from '@/outliner/naming/outliner_naming_group_composition.js';
import { extractHierarchyNameBase } from '@/utils/utils_hierarchy_name_allocator.js';

/**
 * Placement choices of a prefab: it rests on the surface under the aim in 3D
 * views and in 2D views looking straight down.
 */
export const PREFAB_PLACEMENT_AIM_OPTIONS: ClipboardPlacementAimOptions = Object.freeze({
  isRestingInDownwardViews: true,
});

/** Centre of a view in normalized device coordinates. */
const PREFAB_VIEW_CENTRE_NDC = new THREE.Vector2(0, 0);

/** Editor services the prefab actions rely on. */
export interface PrefabEditorActionsHost {
  /** Prefab catalog. */
  readonly store: PrefabCatalogStore;
  /** Map root that receives tied entity groups. */
  readonly worldObject: THREE.Object3D;
  /**
   * Runs an undoable command and refreshes the editor.
   *
   * @param command Command to run.
   */
  commandRun(command: UndoCommand): void;
  /**
   * Returns the clipboard controller that pastes into the map.
   *
   * @returns Controller, or null when the map has none.
   */
  clipboardControllerRead(): ControllerClipboard | null;
  /**
   * Returns the selected objects as the inspector shows them.
   *
   * @returns Selected objects.
   */
  selectedObjectsRead(): THREE.Object3D[];
  /**
   * Returns the camera of the view new objects are placed in.
   *
   * @returns Camera, or null when no view exists.
   */
  activeCameraRead(): THREE.Camera | null;
  /**
   * Shows one project data file in the system file manager.
   *
   * @param fileName Prefab file name.
   * @returns Success, or why the file could not be shown.
   */
  prefabFileReveal(fileName: string): Promise<ProjectDataFileChangeResult>;
  /**
   * Reports a short message in the status bar.
   *
   * @param message Message text.
   */
  statusReport(message: string): void;
  /** Shows text prompts; the modal prompt dialog when omitted. */
  readonly promptShow?: PrefabEditorPromptShow;
}

/**
 * What the editor does with prefabs: make one from the selection, place one at
 * an aimed point or the view centre, rename, recategorize, delete and reveal
 * one, and tie or untie the selection to a brush entity.
 */
export class PrefabEditorActions {
  private readonly host: PrefabEditorActionsHost;
  private readonly prompts: PrefabEditorPrompts;
  private categoryLastUsed = PREFAB_CATEGORY_DEFAULT;

  /**
   * Creates the prefab actions.
   *
   * @param host Editor services.
   */
  constructor(host: PrefabEditorActionsHost) {
    this.host = host;
    this.prompts = new PrefabEditorPrompts(host.store, host.promptShow);
  }

  /**
   * Places a copy of a prefab resting on the surface under an aimed point.
   *
   * @param templateId Prefab id.
   * @param aim View camera and aimed screen point.
   * @returns Pasted objects, or null when the prefab or the map is missing.
   */
  placeAtAim(templateId: string, aim: ClipboardPlacementAim): ClipboardPasteResult | null {
    const controller = this.host.clipboardControllerRead();
    const payload = this.host.store.placementPayloadRead(templateId, true);
    if (controller === null || payload === null) {
      return null;
    }
    return controller.payloadPasteAtAim(payload, aim, PREFAB_PLACEMENT_AIM_OPTIONS);
  }

  /**
   * Places a copy of a prefab resting on the surface at the centre of the
   * active view, or where it was captured when there is no view.
   *
   * @param templateId Prefab id.
   * @returns Pasted objects, or null when the prefab or the map is missing.
   */
  placeAtViewCentre(templateId: string): ClipboardPasteResult | null {
    const camera = this.host.activeCameraRead();
    if (camera !== null) {
      return this.placeAtAim(templateId, { camera, ndc: PREFAB_VIEW_CENTRE_NDC.clone() });
    }
    const controller = this.host.clipboardControllerRead();
    const payload = this.host.store.placementPayloadRead(templateId, true);
    return controller === null || payload === null ? null : controller.payloadPaste(payload, new THREE.Vector3());
  }

  /**
   * Asks for a name and category, then captures the selection as a new prefab
   * as one undoable step.
   *
   * @returns New prefab, or null when cancelled or nothing is selected.
   */
  async makeFromSelection(): Promise<PrefabTemplate | null> {
    const roots = this.host.clipboardControllerRead()?.selectionRootsRead() ?? [];
    if (roots.length === 0) {
      this.host.statusReport('Select objects to make a prefab from');
      return null;
    }
    const answer = await this.prompts.makeAsk(this.categoryLastUsed, PrefabEditorActions.nameSuggest(roots));
    const template = answer === null ? null : this.host.store.templateCapture(answer.name, answer.category, roots);
    if (template === null) {
      return null;
    }
    this.categoryLastUsed = template.category;
    this.host.commandRun(new CommandPrefabTemplateAdd(this.host.store, template));
    this.host.statusReport(`Made prefab ${template.name}`);
    return template;
  }

  /**
   * Suggests a prefab name from the selection: the name of a single selected
   * object or group, or what several selected objects are.
   *
   * @param roots Selected hierarchy roots.
   * @returns Name without the automatic id suffix.
   */
  private static nameSuggest(roots: readonly THREE.Object3D[]): string {
    const soleRoot = roots.length === 1 ? roots[0] : undefined;
    if (soleRoot !== undefined && soleRoot.name.trim() !== '') {
      return extractHierarchyNameBase(soleRoot.name.trim());
    }
    return OutlinerNamingGroupComposition.nameBaseFromMembers(roots);
  }

  /**
   * Asks for a new name of a prefab and renames it as one undoable step.
   *
   * @param templateId Prefab id.
   */
  async renameAsk(templateId: string): Promise<void> {
    const template = this.host.store.templateFind(templateId);
    const name = template === null ? null : await this.prompts.renameAsk(template);
    if (template !== null && name !== null && name !== template.name) {
      this.templateUpdate(template, { ...template, name });
    }
  }

  /**
   * Asks for a new category of a prefab and moves it as one undoable step.
   *
   * @param templateId Prefab id.
   */
  async categoryChangeAsk(templateId: string): Promise<void> {
    const template = this.host.store.templateFind(templateId);
    const category = template === null ? null : await this.prompts.categoryAsk(template);
    if (template !== null && category !== null && category !== template.category) {
      this.categoryLastUsed = category;
      this.templateUpdate(template, { ...template, category });
    }
  }

  /**
   * Deletes a prefab, and its project file, as one undoable step.
   *
   * @param templateId Prefab id.
   */
  remove(templateId: string): void {
    const template = this.host.store.templateFind(templateId);
    if (template !== null) {
      this.host.commandRun(new CommandPrefabTemplateRemove(this.host.store, template));
    }
  }

  /**
   * Shows a project prefab's file in the system file manager, reporting why
   * when it cannot.
   *
   * @param templateId Prefab id.
   */
  async reveal(templateId: string): Promise<void> {
    const result = await this.host.prefabFileReveal(PrefabFileCodec.fileNameFromId(templateId));
    if (!result.ok) {
      this.host.statusReport(result.message);
    }
  }

  /**
   * Returns whether a prefab is a project file that can be revealed.
   *
   * @param templateId Prefab id.
   * @returns True for project prefabs.
   */
  isRevealable(templateId: string): boolean {
    return this.host.store.isPersisted(templateId);
  }

  /** Ties the selection to a brush entity as one undoable step. */
  entityTie(): void {
    const tie = CommandPrefabEntityTie.create(this.host.selectedObjectsRead(), this.host.worldObject);
    if (tie !== null) {
      this.host.commandRun(tie);
    }
  }

  /**
   * Moves the selected entity groups back to world geometry as one undoable
   * step.
   */
  worldMove(): void {
    const worldMove = CommandPrefabEntityWorldMove.create(this.host.selectedObjectsRead());
    if (worldMove !== null) {
      this.host.commandRun(worldMove);
    }
  }

  /**
   * Stores a changed prefab as one undoable step.
   *
   * @param before Prefab as it is.
   * @param after Prefab as it becomes.
   */
  private templateUpdate(before: PrefabTemplate, after: PrefabTemplate): void {
    this.host.commandRun(new CommandPrefabTemplateUpdate(this.host.store, before, after));
  }
}
