import type * as THREE from 'three';
import type { CommandStack } from '@/commands/command_stack.js';
import type { EditorWindow } from '@/editor/window/editor_window.js';
import type { ManagerSelection } from '@/selection/object/manager_selection.js';
import type { SolidModelController } from '@/solid/controller/solid_model_controller.js';
import { ClipboardEventBridge } from '@/clipboard/bridge/clipboard_event_bridge.js';
import { clipboardControllerActive } from '@/clipboard/controller/clipboard_controller_active.js';
import { ClipboardEditCommands } from '@/clipboard/controller/clipboard_edit_commands.js';
import { clipboardMemoryShared } from '@/clipboard/controller/clipboard_memory.js';
import { clipboardSolidModelResolve } from '@/clipboard/controller/clipboard_solid_model_resolve.js';
import { ControllerClipboard, type ControllerClipboardHost } from '@/clipboard/controller/controller_clipboard.js';
import type { ClipboardPlacementViewportPoint } from '@/clipboard/placement/clipboard_placement_cursor.js';
import { ClipboardSystemAccess } from '@/clipboard/system/clipboard_system_access.js';

/** Late-bound layout parts the clipboard commands use. */
export interface LayoutClipboardSource {
  /** World root holding the scene content. */
  readonly worldObject: THREE.Group;
  /** History receiving cut and paste steps. */
  readonly commandStack: CommandStack;
  /** Object selection. */
  readonly selectionManager: ManagerSelection;
  /**
   * Returns the solid model controller.
   *
   * @returns Solid model controller, or null before it exists.
   */
  solidModelControllerRead(): SolidModelController | null;
  /**
   * Returns the editor window that tracks the pointer.
   *
   * @returns Editor window, or null before it exists.
   */
  editorWindowRead(): EditorWindow | null;
  /**
   * Deletes hierarchy objects as one undoable step.
   *
   * @param objects Objects to delete.
   */
  hierarchyObjectsDelete(objects: THREE.Object3D[]): void;
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

/**
 * Returns the view under the pointer the editor window saw last, with that
 * pointer position.
 *
 * @param editorWindow Editor window tracking the pointer, or null.
 * @returns View and pointer, or null when no view is under the pointer.
 */
export function layoutClipboardViewportPointRead(
  editorWindow: EditorWindow | null,
): ClipboardPlacementViewportPoint | null {
  const services = editorWindow?.getServices() ?? null;
  if (editorWindow === null || services === null) {
    return null;
  }
  const ownerDocument = editorWindow.lastPointerOwnerDocument;
  const pointer = editorWindow.hasLastPointerClient
    ? { clientX: editorWindow.lastPointerClientX, clientY: editorWindow.lastPointerClientY }
    : services.getLastPointerClientPosition(ownerDocument);
  if (pointer === null) {
    return null;
  }
  const pane = services.resolveInteractiveViewportAtClientPoint(pointer.clientX, pointer.clientY, ownerDocument);
  return pane === null ? null : { camera: pane.camera, pickElement: pane.pickElement, ...pointer };
}

/**
 * Builds the clipboard controller host over late-bound layout parts.
 *
 * @param source Layout parts the clipboard commands use.
 * @returns Clipboard controller host.
 */
function layoutClipboardControllerHostCreate(source: LayoutClipboardSource): ControllerClipboardHost {
  return {
    worldObject: source.worldObject,
    commandStack: source.commandStack,
    selectionManager: source.selectionManager,
    memory: clipboardMemoryShared,
    solidModelResolve: () => clipboardSolidModelResolve(source.solidModelControllerRead()),
    hierarchyObjectsDelete: (objects) => source.hierarchyObjectsDelete(objects),
    viewportPointRead: () => layoutClipboardViewportPointRead(source.editorWindowRead()),
    gridIntervalRead: () => source.gridIntervalRead(),
    refreshAfterWorldMutation: () => source.refreshAfterWorldMutation(),
    showStatusMessage: (message) => source.showStatusMessage(message),
  };
}

/**
 * The main window's clipboard: the controller, the menu commands and the
 * listener of the document's copy, cut and paste events.
 */
export class LayoutClipboardSystem {
  /** Clipboard controller shared by the menu, the shortcuts and the MCP tools. */
  readonly controller: ControllerClipboard;
  /** Cut, Copy and Paste commands of the Edit menu. */
  readonly editCommands: ClipboardEditCommands;
  private readonly eventBridge: ClipboardEventBridge;

  /**
   * Creates the clipboard, makes it the one the MCP tools use and starts
   * listening to the document's clipboard events.
   *
   * @param source Layout parts the clipboard commands use.
   * @param targetDocument Document whose clipboard events run the commands.
   */
  constructor(source: LayoutClipboardSource, targetDocument: Document) {
    this.controller = new ControllerClipboard(layoutClipboardControllerHostCreate(source));
    this.editCommands = new ClipboardEditCommands(this.controller, new ClipboardSystemAccess());
    this.eventBridge = new ClipboardEventBridge(targetDocument, this.controller);
    this.eventBridge.register();
    clipboardControllerActive.controllerWrite(this.controller);
  }

  /**
   * Stops listening to the document's clipboard events and releases the
   * controller.
   */
  dispose(): void {
    this.eventBridge.unregister();
    clipboardControllerActive.controllerReleaseIfStored(this.controller);
  }
}
