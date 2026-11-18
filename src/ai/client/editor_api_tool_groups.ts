import type { EditorApiHost } from './editor_api_host.js';
import { EditorApiLayers } from './editor_api_layers.js';
import { EditorApiMainWindow } from './editor_api_main_window.js';
import { EditorApiObjectClass } from './editor_api_object_class.js';
import { EditorApiPropertiesSection } from './editor_api_properties_section.js';
import { EditorApiClipboard } from './editor_api_clipboard.js';
import { EditorApiBrushTools } from './editor_api_brush_tools.js';
import { EditorApiFaceUv } from './editor_api_face_uv.js';
import { EditorApiDisplacement } from './editor_api_displacement.js';
import { EditorApiFaceEdit } from './editor_api_face_edit.js';
import { EditorApiViewportInput } from './editor_api_viewport_input.js';
import { EditorApiKeyboardInput } from './editor_api_keyboard_input.js';
import { EditorApiOpenMenus } from './editor_api_open_menus.js';
import { EditorApiEntityBrowser } from './editor_api_entity_browser.js';
import { EditorApiOutliner } from './editor_api_outliner.js';
import { EditorApiSelectionQuery } from './editor_api_selection_query.js';
import { EditorApiSelectionVisibility } from './editor_api_selection_visibility.js';
import { EditorApiTextureReplace } from './editor_api_texture_replace.js';
import { EditorApiTextureBrowser } from './editor_api_texture_browser.js';
import { EditorApiSprinkle } from './editor_api_sprinkle.js';
import { EditorApiModifierVolumes } from './editor_api_modifier_volumes.js';
import { EditorApiProcedural } from './editor_api_procedural.js';
import { EditorApiEntityHandles } from './editor_api_entity_handles.js';
import { editorApiVisibleViewportFind } from './editor_api_viewport_locate.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';

/**
 * Tool groups that each answer only their own tool names: layers, main window,
 * Object Properties dialog, clipboard, brush editing, face UV, displacement,
 * face edit state, viewport input, keyboard input, open menus, the entity
 * browser, outliner row clicks, selection queries, selection visibility,
 * material replacement, the texture browser, Entity Sprinkle, modifier volumes,
 * procedural objects and entity handles.
 */
export class EditorApiToolGroups {
  private readonly layers: EditorApiLayers;
  private readonly mainWindow: EditorApiMainWindow;
  private readonly objectClass: EditorApiObjectClass;
  private readonly propertiesSection: EditorApiPropertiesSection;
  private readonly clipboard: EditorApiClipboard;
  private readonly brushTools: EditorApiBrushTools;
  private readonly faceUv: EditorApiFaceUv;
  private readonly displacement: EditorApiDisplacement;
  private readonly faceEdit: EditorApiFaceEdit;
  private readonly viewportInput: EditorApiViewportInput;
  private readonly keyboardInput: EditorApiKeyboardInput;
  private readonly openMenus: EditorApiOpenMenus;
  private readonly entityBrowser: EditorApiEntityBrowser;
  private readonly outliner: EditorApiOutliner;
  private readonly selectionQuery: EditorApiSelectionQuery;
  private readonly selectionVisibility: EditorApiSelectionVisibility;
  private readonly textureReplace: EditorApiTextureReplace;
  private readonly textureBrowser: EditorApiTextureBrowser;
  private readonly sprinkle: EditorApiSprinkle;
  private readonly modifierVolumes: EditorApiModifierVolumes;
  private readonly procedural: EditorApiProcedural;
  private readonly entityHandles: EditorApiEntityHandles;

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
    this.objectClass = new EditorApiObjectClass(host);
    this.propertiesSection = new EditorApiPropertiesSection(host);
    this.clipboard = new EditorApiClipboard(host);
    this.brushTools = new EditorApiBrushTools(host);
    this.faceUv = new EditorApiFaceUv(host);
    this.displacement = new EditorApiDisplacement(host);
    this.faceEdit = new EditorApiFaceEdit(host);
    this.viewportInput = new EditorApiViewportInput(host, selectionRead);
    this.keyboardInput = new EditorApiKeyboardInput();
    this.openMenus = new EditorApiOpenMenus();
    this.entityBrowser = new EditorApiEntityBrowser(host, selectionRead);
    this.outliner = new EditorApiOutliner(host, selectionRead);
    this.selectionQuery = new EditorApiSelectionQuery(host);
    this.selectionVisibility = new EditorApiSelectionVisibility(host);
    this.textureReplace = new EditorApiTextureReplace(host);
    this.textureBrowser = new EditorApiTextureBrowser();
    this.sprinkle = new EditorApiSprinkle(host);
    this.modifierVolumes = new EditorApiModifierVolumes(host);
    this.procedural = new EditorApiProcedural(host);
    this.entityHandles = new EditorApiEntityHandles(host, (view) => editorApiVisibleViewportFind(host, view));
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
      this.objectClass.objectClassToolDispatch(name, args) ??
      this.propertiesSection.propertiesSectionToolDispatch(name, args) ??
      this.clipboard.clipboardToolDispatch(name, args) ??
      this.brushTools.brushToolDispatch(name, args) ??
      this.faceUv.faceUvToolDispatch(name, args) ??
      this.displacement.displacementToolDispatch(name, args) ??
      this.faceEdit.faceEditToolDispatch(name) ??
      this.viewportInput.viewportInputToolDispatch(name, args) ??
      this.keyboardInput.keyboardInputToolDispatch(name, args) ??
      this.openMenus.openMenusToolDispatch(name, args) ??
      this.entityBrowser.entityBrowserToolDispatch(name, args) ??
      this.outliner.outlinerToolDispatch(name, args) ??
      this.selectionQuery.selectionQueryToolDispatch(name, args) ??
      this.selectionVisibility.selectionVisibilityToolDispatch(name, args) ??
      this.textureReplace.textureReplaceToolDispatch(name, args) ??
      this.textureBrowser.textureBrowserToolDispatch(name) ??
      this.sprinkle.sprinkleToolDispatch(name, args) ??
      this.modifierVolumes.modifierVolumeToolDispatch(name, args) ??
      this.procedural.proceduralToolDispatch(name, args) ??
      this.entityHandles.entityHandlesToolDispatch(name, args)
    );
  }
}
