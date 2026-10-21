import type { EditorApiHost } from './editor_api_host.js';
import { failResult, okResult } from './editor_api_result.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import { clipboardControllerActive } from '@/clipboard/controller/clipboard_controller_active.js';
import { clipboardMemoryShared } from '@/clipboard/controller/clipboard_memory.js';
import { clipboardSolidModelResolve } from '@/clipboard/controller/clipboard_solid_model_resolve.js';
import {
  ControllerClipboard,
  type ClipboardPasteResult,
  type ControllerClipboardHost,
} from '@/clipboard/controller/controller_clipboard.js';
import { HandlerObjectAction } from '@/outliner/hierarchy/handler_object_action.js';

/** Arguments of paste_objects. */
export interface ClipboardPasteArgs {
  /** Clipboard text; the text copied last is used when omitted. */
  text?: unknown;
  /** Pastes at the copied position instead of under the pointer. */
  atOriginalPosition?: unknown;
}

/** Copies the selection to clipboard text and pastes clipboard text. */
export class EditorApiClipboard {
  private ownController: ControllerClipboard | null = null;

  /**
   * Creates the clipboard tools.
   *
   * @param host Live editor systems.
   */
  constructor(private readonly host: EditorApiHost) {}

  /**
   * Runs a clipboard tool.
   *
   * @param name Tool name.
   * @param args Tool arguments.
   * @returns Tool result, or null when the name is no clipboard tool.
   */
  clipboardToolDispatch(name: string, args: Record<string, unknown>): McpToolResult | null {
    switch (name) {
      case 'copy_selection':
        return this.selectionCopy();
      case 'paste_objects':
        return this.objectsPaste(args as ClipboardPasteArgs);
      default:
        return null;
    }
  }

  /**
   * Copies the selected objects as clipboard text.
   *
   * @returns Result with the text and the copied count, or a failure when
   *   nothing is selected.
   */
  private selectionCopy(): McpToolResult {
    const copied = this.controllerRead().copy();
    if (copied === null) {
      return failResult('Nothing to copy: select objects first');
    }
    return okResult(`Copied ${copied.count} object(s)`, { text: copied.text, count: copied.count });
  }

  /**
   * Pastes clipboard text and reports the ids of the pasted objects.
   *
   * @param args Tool arguments.
   * @returns Result with the pasted ids, or the reason nothing was pasted.
   */
  private objectsPaste(args: ClipboardPasteArgs): McpToolResult {
    const problem = this.pasteArgsProblemFind(args);
    if (problem !== null) {
      return failResult(problem);
    }
    const controller = this.controllerRead();
    const text = typeof args.text === 'string' ? args.text : controller.lastCopiedTextRead();
    if (text === null) {
      return failResult('Nothing to paste: pass text or call copy_selection first');
    }
    const pasted = this.pasteRun(controller, text, args.atOriginalPosition === true);
    if (pasted === null) {
      return failResult('The text holds no BevyBroom objects');
    }
    return okResult(`Pasted ${pasted.ids.length} object(s)`, { ids: pasted.ids }, { createdIds: pasted.ids });
  }

  /**
   * Finds the first invalid argument of a paste_objects call.
   *
   * @param args Tool arguments.
   * @returns Problem description, or null when every argument is valid.
   */
  private pasteArgsProblemFind(args: ClipboardPasteArgs): string | null {
    if (args.text !== undefined && typeof args.text !== 'string') {
      return 'text must be a string';
    }
    if (args.atOriginalPosition !== undefined && typeof args.atOriginalPosition !== 'boolean') {
      return 'atOriginalPosition must be true or false';
    }
    return null;
  }

  /**
   * Pastes text under the pointer or at the copied position.
   *
   * @param controller Clipboard controller doing the paste.
   * @param text Clipboard text.
   * @param atOriginalPosition Whether to paste at the copied position.
   * @returns Pasted objects, or null when the text holds no editor objects.
   */
  private pasteRun(
    controller: ControllerClipboard,
    text: string,
    atOriginalPosition: boolean,
  ): ClipboardPasteResult | null {
    return atOriginalPosition ? controller.pasteAtOriginalPosition(text) : controller.pasteAtCursor(text);
  }

  /**
   * Returns the main window clipboard, or one built over the host when the main
   * window has none.
   *
   * @returns Clipboard controller.
   */
  private controllerRead(): ControllerClipboard {
    const active = clipboardControllerActive.controllerRead();
    if (active !== null) {
      return active;
    }
    this.ownController ??= new ControllerClipboard(this.controllerHostCreate());
    return this.ownController;
  }

  /**
   * Builds a clipboard controller host over the editor API host. It has no
   * pointer, so pastes under the pointer land at the copied position.
   *
   * @returns Clipboard controller host.
   */
  private controllerHostCreate(): ControllerClipboardHost {
    const host = this.host;
    const objectActions = new HandlerObjectAction(host.worldObject, host.commandStack, host.selectionManager);
    return {
      worldObject: host.worldObject,
      commandStack: host.commandStack,
      selectionManager: host.selectionManager,
      memory: clipboardMemoryShared,
      solidModelResolve: () => clipboardSolidModelResolve(host.solidModelController),
      hierarchyObjectsDelete: (objects) => objectActions.deleteHierarchyObjects(objects),
      viewportPointRead: () => null,
      gridIntervalRead: () => (host.getUserSnapEnabled() ? host.snapManager.getInterval() : 0),
      refreshAfterWorldMutation: () => host.refreshAfterWorldMutation(),
      showStatusMessage: (message) => host.showStatus(message),
    };
  }
}
