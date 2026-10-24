import type { EditorApiHost } from './editor_api_host.js';
import { EditorApiLayers } from './editor_api_layers.js';
import { EditorApiMainWindow } from './editor_api_main_window.js';
import { EditorApiClipboard } from './editor_api_clipboard.js';
import { EditorApiBrushTools } from './editor_api_brush_tools.js';
import { EditorApiFaceUv } from './editor_api_face_uv.js';
import { EditorApiViewportInput } from './editor_api_viewport_input.js';
import { EditorApiSelectionQuery } from './editor_api_selection_query.js';
import { EditorApiSelectionVisibility } from './editor_api_selection_visibility.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';

/**
 * Tool groups that each answer only their own tool names: layers, main window,
 * clipboard, brush editing, face UV, viewport input, selection queries and
 * selection visibility.
 */
export class EditorApiToolGroups {
  private readonly layers: EditorApiLayers;
  private readonly mainWindow: EditorApiMainWindow;
  private readonly clipboard: EditorApiClipboard;
  private readonly brushTools: EditorApiBrushTools;
  private readonly faceUv: EditorApiFaceUv;
  private readonly viewportInput: EditorApiViewportInput;
  private readonly selectionQuery: EditorApiSelectionQuery;
  private readonly selectionVisibility: EditorApiSelectionVisibility;

  /**
   * Creates every tool group over the editor host.
   *
   * @param host Live editor systems.
   * @param selectionRead Returns the selection summary the viewport input tools
   *   report.
   */
  constructor(host: EditorApiHost, selectionRead: () => McpToolResult) {
    this.layers = new EditorApiLayers(host);
    this.mainWindow = new EditorApiMainWindow(host);
    this.clipboard = new EditorApiClipboard(host);
    this.brushTools = new EditorApiBrushTools(host);
    this.faceUv = new EditorApiFaceUv(host);
    this.viewportInput = new EditorApiViewportInput(host, selectionRead);
    this.selectionQuery = new EditorApiSelectionQuery(host);
    this.selectionVisibility = new EditorApiSelectionVisibility(host);
  }

  /**
   * Runs a tool of whichever group owns its name.
   *
   * @param name Tool name.
   * @param args Tool arguments.
   * @returns Tool result, or null when no group owns the name.
   */
  toolGroupDispatch(name: string, args: Record<string, unknown>): McpToolResult | null {
    return (
      this.layers.layerToolDispatch(name, args) ??
      this.mainWindow.mainWindowToolDispatch(name, args) ??
      this.clipboard.clipboardToolDispatch(name, args) ??
      this.brushTools.brushToolDispatch(name, args) ??
      this.faceUv.faceUvToolDispatch(name, args) ??
      this.viewportInput.viewportInputToolDispatch(name, args) ??
      this.selectionQuery.selectionQueryToolDispatch(name, args) ??
      this.selectionVisibility.selectionVisibilityToolDispatch(name, args)
    );
  }
}
