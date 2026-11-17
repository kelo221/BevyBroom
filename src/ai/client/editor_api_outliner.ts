import type * as THREE from 'three';
import type { EditorApiHost } from './editor_api_host.js';
import { resolveBrushMeshes } from './editor_api_lookup.js';
import { failResult, okResult } from './editor_api_result.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import { OUTLINER_ROW_OBJECT_UUID_ATTRIBUTE } from '@/outliner/ui/outliner_tree_drag_row_hit.js';

/** Modifier keys held during an outliner row click. */
interface EditorApiOutlinerClickModifiers {
  /** Shift held: select the range from the last plain click. */
  readonly shiftKey: boolean;
  /** Ctrl held: toggle the row. */
  readonly ctrlKey: boolean;
}

/**
 * Clicks outliner rows the way a user does, through a mouse press and click on
 * the row element with modifier keys held.
 */
export class EditorApiOutliner {
  private readonly host: EditorApiHost;
  private readonly selectionResultRead: () => McpToolResult;
  private readonly ownerDocument: Document;

  /**
   * Creates the outliner tools.
   *
   * @param host Editor host holding the world.
   * @param selectionResultRead Reads the selection as a tool result.
   * @param ownerDocument Document the outliner is shown in.
   */
  constructor(host: EditorApiHost, selectionResultRead: () => McpToolResult, ownerDocument: Document = document) {
    this.host = host;
    this.selectionResultRead = selectionResultRead;
    this.ownerDocument = ownerDocument;
  }

  /**
   * Runs an outliner tool.
   *
   * @param name Tool name.
   * @param args Tool arguments.
   * @returns Tool result, or null when the name is no outliner tool.
   */
  outlinerToolDispatch(name: string, args: Record<string, unknown>): McpToolResult | null {
    return name === 'outliner_click' ? this.rowClick(args) : null;
  }

  /**
   * Clicks the row of a brush, group or solid model with the requested keys.
   *
   * @param args Tool arguments with id, shift and ctrl.
   * @returns Result with the selection after the click and the page text left
   *   selected by it.
   */
  private rowClick(args: Record<string, unknown>): McpToolResult {
    const objectId = typeof args['id'] === 'string' ? args['id'] : '';
    const row = this.rowElementFind(this.rowObjectResolve(objectId));
    if (row === null) {
      return failResult(`No outliner row shows ${objectId}; expand its parents and scroll it into view`);
    }
    this.rowPointerClickSend(row, { shiftKey: args['shift'] === true, ctrlKey: args['ctrl'] === true });
    const selection = this.selectionResultRead().data;
    const pageSelectedText = this.ownerDocument.getSelection()?.toString() ?? '';
    return okResult(`Clicked the outliner row of ${objectId}`, { selection, pageSelectedText });
  }

  /**
   * Resolves the object of a brush id, or of a group or solid model uuid.
   *
   * @param objectId Brush id, group id or solid model id.
   * @returns Object shown by the row, or null when unknown.
   */
  private rowObjectResolve(objectId: string): THREE.Object3D | null {
    const brushMesh = resolveBrushMeshes(this.host.worldObject, [objectId])[0];
    return brushMesh ?? this.host.worldObject.getObjectByProperty('uuid', objectId) ?? null;
  }

  /**
   * Finds the shown row element of an object.
   *
   * @param object Object of the row.
   * @returns Row element, or null when no shown row holds the object.
   */
  private rowElementFind(object: THREE.Object3D | null): HTMLElement | null {
    if (object === null) {
      return null;
    }
    const selector = `[${OUTLINER_ROW_OBJECT_UUID_ATTRIBUTE}="${CSS.escape(object.uuid)}"]`;
    const rows = [...this.ownerDocument.querySelectorAll<HTMLElement>(selector)];
    return rows.find((row) => row.style.display !== 'none' && row.isConnected) ?? null;
  }

  /**
   * Sends a mouse press and a click to a row with modifier keys held.
   *
   * @param row Row element.
   * @param modifiers Held modifier keys.
   */
  private rowPointerClickSend(row: HTMLElement, modifiers: EditorApiOutlinerClickModifiers): void {
    const rect = row.getBoundingClientRect();
    const point = { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
    const eventInit = { bubbles: true, cancelable: true, button: 0, detail: 1, ...point, ...modifiers };
    row.dispatchEvent(new MouseEvent('mousedown', eventInit));
    row.dispatchEvent(new MouseEvent('mouseup', eventInit));
    row.dispatchEvent(new MouseEvent('click', eventInit));
  }
}
