import type * as THREE from 'three';
import type { CommandStack } from '@/commands/command_stack.js';
import type { ManagerSelection } from '@/selection/object/manager_selection.js';
import type { StatusBar } from '@/ui/status/status_bar.js';
import { TextureReplaceRunner } from '@/texture/replace/texture_replace_runner.js';
import { getStateFaceEditSession } from '@/texture/paint/state_face_edit_session.js';
import { PanelFloatingTextureBrowser } from '@/texture/ui/texture_browser/panel_floating_texture_browser.js';
import {
  DialogTextureReplace,
  type DialogTextureReplaceMaterial,
} from '@/texture/ui/texture_replace/dialog_texture_replace.js';
import { DialogFaceEditSheet } from '@/texture/ui/face_edit_sheet/dialog_face_edit_sheet.js';
import type { DialogFaceEditSheetHandlers } from '@/texture/ui/face_edit_sheet/face_edit_sheet_handlers.js';
import type { UvEditorTrsFieldState } from '@/texture/uv/face_texture_applier.js';
import { FaceAttributesViewGroup } from '@/texture/ui/face_attributes/face_attributes_view_group.js';
import type { FaceAttributesView } from '@/texture/ui/face_attributes/face_attributes_view.js';
import type { FaceInspectorSetupResult } from './layout_face_inspector_setup.js';
import { PanelDisplacementTab } from '@/displacement/ui/panel_displacement_tab.js';
import { displacementActionsSharedRead } from '@/displacement/controller/displacement_actions_shared.js';

/** Editor services the floating texture windows are built from. */
export interface LayoutTextureWindowsDeps {
  /** Parent element of floating windows. */
  readonly host: HTMLElement;
  /** Face inspector with the controllers that drive it. */
  readonly faceInspectorParts: FaceInspectorSetupResult;
  /** Undo stack receiving material replacements. */
  readonly commandStack: CommandStack;
  /** Scene root whose brushes are searched by the replacement. */
  readonly worldObject: THREE.Object3D;
  /** Object selection limiting the replacement scope. */
  readonly selectionManager: ManagerSelection;
  /** Status bar receiving replacement feedback, or null. */
  readonly statusBar: StatusBar | null;
  /** Refreshes viewport shading after face materials changed. */
  readonly afterSurfaceChange: () => void;
}

/**
 * Floating texture windows of the main window: the texture browser holding the
 * face inspector, the Face Edit Sheet with its Displacement tab and the Replace
 * Textures window. The face inspector refreshes while the texture browser or
 * the sheet is open.
 */
export class LayoutTextureWindows {
  /** Floating texture browser holding the face inspector. */
  readonly textureBrowser: PanelFloatingTextureBrowser;
  /** Replace Textures window. */
  readonly textureReplaceDialog: DialogTextureReplace;
  /** Floating Hammer++ Face Edit Sheet. */
  readonly faceEditSheet: DialogFaceEditSheet;
  /** Displacement tab shown inside the Face Edit Sheet. */
  readonly displacementTab: PanelDisplacementTab;
  private readonly deps: LayoutTextureWindowsDeps;
  private readonly unsubscribers: Array<() => void>;

  /**
   * Creates the floating texture windows and wires them to the face inspector.
   *
   * @param deps Editor services.
   */
  constructor(deps: LayoutTextureWindowsDeps) {
    this.deps = deps;
    this.textureBrowser = new PanelFloatingTextureBrowser(deps.host, deps.faceInspectorParts.faceInspector);
    this.textureReplaceDialog = this.textureReplaceDialogCreate();
    this.faceEditSheet = new DialogFaceEditSheet(deps.host, this.faceEditSheetHandlersBuild());
    this.displacementTab = this.displacementTabMount();
    this.faceAttributesViewsWire();
    this.unsubscribers = [
      this.textureBrowser.openChangeListenerAdd(() => this.faceInspectorVisibilityRefresh()),
      getStateFaceEditSession().changeListenerAdd(() => this.faceInspectorVisibilityRefresh()),
    ];
    this.faceInspectorVisibilityRefresh();
  }

  /** Opens the floating texture browser. */
  textureBrowserShow(): void {
    this.textureBrowser.show();
  }

  /**
   * Opens the Replace Textures window with a material preset as the one to
   * find.
   *
   * @param textureId Material to find.
   */
  textureReplaceOpen(textureId: string): void {
    this.textureReplaceDialog.openFor(textureId);
  }

  /** Opens the Face Edit Sheet. */
  faceEditSheetReveal(): void {
    getStateFaceEditSession().sheetOpenWrite(true);
  }

  /** Removes the listeners and disposes every floating texture window. */
  dispose(): void {
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.unsubscribers.length = 0;
    this.displacementTab.dispose();
    this.faceEditSheet.dispose();
    this.textureReplaceDialog.dispose();
    this.textureBrowser.dispose();
  }

  /** Lets the face inspector refresh only while a window showing it is open. */
  private faceInspectorVisibilityRefresh(): void {
    const isShown = this.textureBrowser.isOpen() || getStateFaceEditSession().sheetOpenRead();
    if (this.deps.faceInspectorParts.faceInspector.isVisible() !== isShown) {
      this.deps.faceInspectorParts.faceInspector.setVisible(isShown);
    }
  }

  /**
   * Creates the Displacement tab inside the Face Edit Sheet.
   *
   * @returns Mounted Displacement tab.
   */
  private displacementTabMount(): PanelDisplacementTab {
    const tab = new PanelDisplacementTab({
      actionsRead: () => displacementActionsSharedRead(),
      statusReport: (message) => this.deps.statusBar?.setLastAction(message),
      afterChange: () => this.deps.afterSurfaceChange(),
    });
    this.faceEditSheet.displacementTabBodyRead().appendChild(tab.getElement());
    return tab;
  }

  /**
   * Makes the UV controller show the selection in the attributes editor and the
   * sheet.
   */
  private faceAttributesViewsWire(): void {
    const parts = this.deps.faceInspectorParts;
    const sheetView: FaceAttributesView = {
      setFromFieldState: (fields) => this.faceEditSheetSelectionWrite(fields),
    };
    parts.uvEditorController.setView(
      new FaceAttributesViewGroup([parts.faceInspector.getFaceAttributesEditor(), sheetView]),
    );
  }

  /**
   * Shows the face selection in the Face Edit Sheet: the field values plus the
   * UV vectors, tool status and shear read from the face UV tools.
   *
   * @param fields Shared or mixed face attribute values.
   */
  private faceEditSheetSelectionWrite(fields: UvEditorTrsFieldState): void {
    const uvTools = this.deps.faceInspectorParts.faceUvToolsController;
    this.faceEditSheet.selectionWrite({
      fields,
      vectors: uvTools?.readFirstVectors2x3() ?? null,
      uvToolStatus: uvTools?.readSelectionStatus() ?? null,
      shearU: uvTools?.readSharedShear('u-by-v') ?? null,
      shearV: uvTools?.readSharedShear('v-by-u') ?? null,
    });
  }

  /**
   * Builds the Face Edit Sheet callbacks over the face inspector controllers.
   *
   * @returns Sheet handlers.
   */
  private faceEditSheetHandlersBuild(): DialogFaceEditSheetHandlers {
    const parts = this.deps.faceInspectorParts;
    const uvTools = parts.faceUvToolsController;
    return {
      ...parts.faceAttributesHandlers,
      onShiftFullTile: (tilesU, tilesV) => uvTools?.shiftFullTile(tilesU, tilesV),
      onSetVectors2x3: (vectors) => uvTools?.setVectors2x3(vectors),
      onMarkFacesWithTexture: (textureId) => parts.materialUsageController?.selectFacesUsingTexture(textureId),
      onBrowseMaterial: () => this.textureBrowserShow(),
      onReplaceTexture: (textureId) => this.textureReplaceOpen(textureId),
      onApplyTexture: (textureId) => parts.textureBrowserController.selectTexture(textureId),
      texturesList: () => this.libraryMaterialsRead(),
      textureDescribe: (textureId) => parts.materialDescribe(textureId),
    };
  }

  /**
   * Creates the Replace Textures window over the editor world.
   *
   * @returns Replace Textures window.
   */
  private textureReplaceDialogCreate(): DialogTextureReplace {
    const textureReplaceRunner = new TextureReplaceRunner({
      commandStack: this.deps.commandStack,
      worldObject: this.deps.worldObject,
      selectionManager: this.deps.selectionManager,
      afterReplace: () => this.deps.afterSurfaceChange(),
      resultReport: (message) => this.deps.statusBar?.setLastAction(message),
    });
    return new DialogTextureReplace(this.deps.host, {
      materialsList: () => this.libraryMaterialsRead(),
      scopeDefaultRead: () => textureReplaceRunner.scopeForSelectionRead(),
      replace: (findId, replaceId, scope) => textureReplaceRunner.run(findId, replaceId, scope),
    });
  }

  /**
   * Lists the materials of the texture library.
   *
   * @returns Library materials.
   */
  private libraryMaterialsRead(): DialogTextureReplaceMaterial[] {
    const library = this.deps.faceInspectorParts.textureBrowserController.getLibrary();
    return library.getEntries().map((entry) => ({ id: entry.id, displayName: entry.displayName }));
  }
}
