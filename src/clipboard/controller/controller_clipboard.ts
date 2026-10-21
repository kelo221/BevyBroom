import * as THREE from 'three';
import type { CommandStack } from '@/commands/command_stack.js';
import { CommandUndoBatch } from '@/commands/command_undo_batch.js';
import type { ManagerSelection } from '@/selection/object/manager_selection.js';
import { selectionMeshesFromHierarchyCollect } from '@/selection/object/selection_hierarchy_meshes.js';
import {
  selectionEntityPickMeshesResolveToOwners,
  selectionRootsCollect,
} from '@/selection/object/selection_roots_classify.js';
import { CommandSolidModelCreate } from '@/solid/commands/model/command_solid_model_create.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { filterUnlockedObjects } from '@/utils/object_lock.js';
import { CommandClipboardPaste } from '@/clipboard/commands/command_clipboard_paste.js';
import type { ClipboardMemory } from '@/clipboard/controller/clipboard_memory.js';
import { clipboardBoundsFromPayload } from '@/clipboard/payload/clipboard_payload_bounds.js';
import { ClipboardPayloadEncoder } from '@/clipboard/payload/clipboard_payload_encoder.js';
import { clipboardPayloadIdentitiesRefresh } from '@/clipboard/payload/clipboard_payload_identity.js';
import { clipboardPayloadOffsetApply } from '@/clipboard/payload/clipboard_payload_offset.js';
import { clipboardPayloadTextRead, clipboardPayloadTextWrite } from '@/clipboard/payload/clipboard_payload_text.js';
import type { ClipboardPayload } from '@/clipboard/payload/clipboard_payload_types.js';
import {
  clipboardPlacementCursorOffsetCompute,
  type ClipboardPlacementViewportPoint,
} from '@/clipboard/placement/clipboard_placement_cursor.js';

/**
 * Name of the solid model created when brushes are pasted into a world without
 * one.
 */
export const CLIPBOARD_PASTE_SOLID_MODEL_NAME = 'World';

/** Editor parts the clipboard commands read and change. */
export interface ControllerClipboardHost {
  /** World root holding the scene content. */
  readonly worldObject: THREE.Group;
  /** History receiving cut and paste steps. */
  readonly commandStack: CommandStack;
  /** Selection that is copied and that pasted objects replace. */
  readonly selectionManager: ManagerSelection;
  /** Memory of the text copied last. */
  readonly memory: ClipboardMemory;
  /**
   * Returns the solid model pasted brushes join.
   *
   * @returns Active or first solid model, or null when the world has none.
   */
  solidModelResolve(): SolidModel | null;
  /**
   * Deletes hierarchy objects as one undoable step.
   *
   * @param objects Objects to delete.
   */
  hierarchyObjectsDelete(objects: THREE.Object3D[]): void;
  /**
   * Returns the view and pointer a paste at the cursor is placed under.
   *
   * @returns View and pointer, or null when no view is under the pointer.
   */
  viewportPointRead(): ClipboardPlacementViewportPoint | null;
  /**
   * Returns the grid step pasted content snaps to.
   *
   * @returns Grid step, or zero when snapping is off.
   */
  gridIntervalRead(): number;
  /** Refreshes views, outliner and panels after the world changed. */
  refreshAfterWorldMutation(): void;
  /**
   * Shows a status bar message.
   *
   * @param message Message text.
   */
  showStatusMessage(message: string): void;
}

/** Text written by one copy or cut. */
export interface ClipboardCopyResult {
  /** Clipboard text holding the copied objects. */
  readonly text: string;
  /** Number of copied hierarchy roots. */
  readonly count: number;
}

/** Objects created by one paste. */
export interface ClipboardPasteResult {
  /** Pasted top-level objects, brush meshes and solid CSG groups. */
  readonly roots: THREE.Object3D[];
  /** Object uuids, brush ids and group uuids of the roots, in the same order. */
  readonly ids: string[];
}

/**
 * Copies the selection to clipboard text, cuts it, and pastes clipboard text at
 * the cursor or at the copied position as one undoable step each.
 */
export class ControllerClipboard {
  /**
   * Creates the clipboard commands over live editor parts.
   *
   * @param host Editor parts the commands read and change.
   */
  constructor(private readonly host: ControllerClipboardHost) {}

  /**
   * Writes the selected objects as clipboard text and remembers it.
   *
   * @returns Clipboard text and copied count, or null when nothing copyable is
   *   selected.
   */
  copy(): ClipboardCopyResult | null {
    const roots = this.selectionRootsRead();
    const text = this.rootsTextWrite(roots);
    if (text === null) {
      this.host.showStatusMessage('Nothing to copy');
      return null;
    }
    this.host.showStatusMessage(`Copied ${roots.length} object(s)`);
    return { text, count: roots.length };
  }

  /**
   * Copies the unlocked selected objects, then deletes them as one undoable
   * step.
   *
   * @returns Clipboard text and cut count, or null when nothing copyable is
   *   selected.
   */
  cut(): ClipboardCopyResult | null {
    const roots = filterUnlockedObjects(this.selectionRootsRead());
    const text = this.rootsTextWrite(roots);
    if (text === null) {
      this.host.showStatusMessage('Nothing to cut');
      return null;
    }
    this.host.hierarchyObjectsDelete(roots);
    this.host.showStatusMessage(`Cut ${roots.length} object(s)`);
    return { text, count: roots.length };
  }

  /**
   * Pastes clipboard text under the pointer of the view the pointer is over, or
   * at the copied position when no view is under the pointer.
   *
   * @param text Clipboard text.
   * @returns Pasted objects, or null when the text holds no editor objects.
   */
  pasteAtCursor(text: string): ClipboardPasteResult | null {
    return this.paste(text, (payload) => this.cursorOffsetCompute(payload));
  }

  /**
   * Pastes clipboard text at the position it was copied from.
   *
   * @param text Clipboard text.
   * @returns Pasted objects, or null when the text holds no editor objects.
   */
  pasteAtOriginalPosition(text: string): ClipboardPasteResult | null {
    return this.paste(text, () => new THREE.Vector3());
  }

  /**
   * Returns the text copied last by any clipboard command.
   *
   * @returns Copied text, or null before the first copy.
   */
  lastCopiedTextRead(): string | null {
    return this.host.memory.lastCopiedTextRead();
  }

  /**
   * Returns whether the selection holds anything to copy or cut.
   *
   * @returns True when at least one hierarchy root is selected.
   */
  selectionHasObjectsIs(): boolean {
    return this.selectionRootsRead().length > 0;
  }

  /**
   * Returns the outermost selected hierarchy roots, with entity pick meshes
   * resolved to their owners.
   *
   * @returns Selected roots.
   */
  private selectionRootsRead(): THREE.Object3D[] {
    const selection = this.host.selectionManager;
    const inspectorObjects = selection.getInspectorObjects();
    const objects = inspectorObjects.length > 0 ? inspectorObjects : [...selection.getSelectedObjects()];
    return selectionRootsCollect(selectionEntityPickMeshesResolveToOwners(objects), this.host.worldObject);
  }

  /**
   * Writes roots as clipboard text and remembers it.
   *
   * @param roots Hierarchy roots to write.
   * @returns Clipboard text, or null when nothing copyable was given.
   */
  private rootsTextWrite(roots: readonly THREE.Object3D[]): string | null {
    const payload = ClipboardPayloadEncoder.encode(roots);
    if (payload === null) {
      return null;
    }
    const text = clipboardPayloadTextWrite(payload);
    this.host.memory.lastCopiedTextWrite(text);
    return text;
  }

  /**
   * Pastes clipboard text moved by a computed offset, selects the result and
   * reports it.
   *
   * @param text Clipboard text.
   * @param offsetCompute Computes the world offset for the read payload.
   * @returns Pasted objects, or null when the text holds no editor objects.
   */
  private paste(
    text: string,
    offsetCompute: (payload: ClipboardPayload) => THREE.Vector3,
  ): ClipboardPasteResult | null {
    const stored = clipboardPayloadTextRead(text);
    if (stored === null) {
      this.host.showStatusMessage('The clipboard holds no BevyBroom objects');
      return null;
    }
    const payload = clipboardPayloadIdentitiesRefresh(stored);
    clipboardPayloadOffsetApply(payload, offsetCompute(payload));
    const command = this.pasteCommandPush(payload);
    const roots = command.pastedRootsRead();
    this.host.selectionManager.setSelection(selectionMeshesFromHierarchyCollect(roots), roots);
    this.host.refreshAfterWorldMutation();
    this.host.showStatusMessage(`Pasted ${roots.length} object(s)`);
    return { roots, ids: command.pastedIdsRead() };
  }

  /**
   * Pushes the paste onto the history, creating a solid model first when
   * brushes are pasted into a world without one.
   *
   * @param payload Payload with fresh identities at its final placement.
   * @returns The executed paste command.
   */
  private pasteCommandPush(payload: ClipboardPayload): CommandClipboardPaste {
    const needsModel = payload.brushes.brushes.length > 0;
    const existingModel = needsModel ? this.host.solidModelResolve() : null;
    const createdModel = needsModel && existingModel === null ? new SolidModel(CLIPBOARD_PASTE_SOLID_MODEL_NAME) : null;
    const command = new CommandClipboardPaste(payload, this.host.worldObject, existingModel ?? createdModel);
    if (createdModel === null) {
      this.host.commandStack.push(command);
      return command;
    }
    const modelCreate = new CommandSolidModelCreate(createdModel, this.host.worldObject);
    this.host.commandStack.push(new CommandUndoBatch([modelCreate, command]));
    return command;
  }

  /**
   * Computes the offset that moves a payload under the pointer.
   *
   * @param payload Payload being pasted.
   * @returns World offset, or zero when no view is under the pointer.
   */
  private cursorOffsetCompute(payload: ClipboardPayload): THREE.Vector3 {
    const viewportPoint = this.host.viewportPointRead();
    if (viewportPoint === null) {
      return new THREE.Vector3();
    }
    const bounds = clipboardBoundsFromPayload(payload.bounds);
    return clipboardPlacementCursorOffsetCompute(
      viewportPoint,
      bounds,
      this.host.worldObject,
      this.host.gridIntervalRead(),
    );
  }
}
