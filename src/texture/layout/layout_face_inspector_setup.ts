import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { CommandStack } from '@/commands/command_stack.js';
import { ControllerFaceExtrusion } from '@/tools/face/controller_face_extrusion.js';
import { ControllerUvEditor } from '@/texture/controller/controller_uv_editor.js';
import { ControllerTextureBrowser } from '@/texture/controller/controller_texture_browser.js';
import { ControllerTextureAssignment } from '@/texture/controller/controller_texture_assignment.js';
import { FaceAttributesEditor } from '@/texture/ui/face_attributes/face_attributes_editor.js';
import type { FaceAttributesMaterialDescription } from '@/texture/ui/face_attributes/face_attributes_material_row.js';
import { MaterialBrowser } from '@/texture/ui/material_browser/material_browser.js';
import { FaceInspector } from '@/texture/ui/face_inspector/face_inspector.js';
import type { TextureBrowserEntry } from '@/texture/library/texture_browser_entry.js';
import { StatusBar } from '@/ui/status/status_bar.js';

/** Services the face inspector and its controllers are built from. */
export interface FaceInspectorSetupDeps {
  selectionManager: ManagerSelection;
  faceController: ControllerFaceExtrusion;
  commandStack: CommandStack;
  statusBar: StatusBar | null;
  afterSurfaceChange: () => void;
}

/** Face inspector with the controllers that drive it. */
export interface FaceInspectorSetupResult {
  faceInspector: FaceInspector;
  uvEditorController: ControllerUvEditor;
  textureBrowserController: ControllerTextureBrowser;
  textureAssignmentController: ControllerTextureAssignment;
}

/** Late-bound controller references the views call into after construction. */
interface FaceInspectorControllerSlots {
  textureBrowserController: ControllerTextureBrowser | null;
}

/**
 * Builds the docked Face tab: face attributes over the material browser, with
 * the UV, library and assignment controllers wired to selection and undo.
 *
 * @param deps Shared editor services.
 * @returns Face inspector and its controllers.
 */
export function faceInspectorSetup(deps: FaceInspectorSetupDeps): FaceInspectorSetupResult {
  const slots: FaceInspectorControllerSlots = { textureBrowserController: null };
  const uvEditorController = faceInspectorUvControllerCreate(deps);
  const textureAssignmentController = faceInspectorAssignmentControllerCreate(deps);
  const faceAttributesEditor = faceInspectorAttributesEditorCreate(deps, uvEditorController, slots);
  const materialBrowser = faceInspectorMaterialBrowserCreate(slots);
  const textureBrowserController = faceInspectorBrowserControllerCreate(deps, materialBrowser);
  const faceInspector = new FaceInspector({
    faceAttributesEditor,
    materialBrowser,
    selectionSource: uvEditorController,
  });
  slots.textureBrowserController = textureBrowserController;
  uvEditorController.setView(faceAttributesEditor);
  faceInspectorMaterialSelectionWire(deps, textureBrowserController, textureAssignmentController, faceInspector);
  deps.faceController.setFaceSelectionChangedCallback(() => faceInspector.refreshFromSelection());
  faceInspector.refreshFromSelection();
  return { faceInspector, uvEditorController, textureBrowserController, textureAssignmentController };
}

/**
 * Creates the UV mapping controller with status bar feedback.
 *
 * @param deps Face inspector setup dependencies.
 * @returns UV mapping controller.
 */
function faceInspectorUvControllerCreate(deps: FaceInspectorSetupDeps): ControllerUvEditor {
  const controller = new ControllerUvEditor(deps.selectionManager, deps.faceController, deps.commandStack);
  controller.setStatusCallback((message) => deps.statusBar?.setLastAction(message));
  return controller;
}

/**
 * Creates the texture assignment controller with status bar feedback.
 *
 * @param deps Face inspector setup dependencies.
 * @returns Texture assignment controller.
 */
function faceInspectorAssignmentControllerCreate(deps: FaceInspectorSetupDeps): ControllerTextureAssignment {
  const controller = new ControllerTextureAssignment(deps.selectionManager, deps.faceController, deps.commandStack);
  controller.setStatusCallback((message) => deps.statusBar?.setLastAction(message));
  return controller;
}

/**
 * Creates the face attributes editor whose edits go through the UV controller.
 *
 * @param deps Face inspector setup dependencies.
 * @param controller UV mapping controller.
 * @param slots Late-bound browser controller used to describe materials.
 * @returns Face attributes editor.
 */
function faceInspectorAttributesEditorCreate(
  deps: FaceInspectorSetupDeps,
  controller: ControllerUvEditor,
  slots: FaceInspectorControllerSlots,
): FaceAttributesEditor {
  const afterEdit = (edit: () => void) => {
    edit();
    deps.afterSurfaceChange();
  };
  return new FaceAttributesEditor(
    {
      onAlign: (align) => afterEdit(() => controller.applyAlign(align)),
      onApplyPartialTrs: (fields) => afterEdit(() => controller.applyPartialTrsFields(fields)),
      onRelativeOp: (op) => afterEdit(() => controller.applyRelativeOp(op)),
      onReset: () => afterEdit(() => controller.resetMapping()),
    },
    (textureId) => faceInspectorMaterialDescribe(slots.textureBrowserController, textureId),
  );
}

/**
 * Describes a material from the browser controller's library.
 *
 * @param controller Texture browser controller, or null before it exists.
 * @param textureId Texture identity.
 * @returns Name and preview, or null when the library does not list it.
 */
function faceInspectorMaterialDescribe(
  controller: ControllerTextureBrowser | null,
  textureId: string,
): FaceAttributesMaterialDescription | null {
  const entry = controller?.getLibrary().getEntryById(textureId) ?? null;
  if (entry === null) {
    return null;
  }
  return { displayName: entry.displayName, previewObjectUrl: entry.previewObjectUrl };
}

/**
 * Creates the material browser whose actions go through the browser controller.
 *
 * @param slots Late-bound browser controller.
 * @returns Material browser.
 */
function faceInspectorMaterialBrowserCreate(slots: FaceInspectorControllerSlots): MaterialBrowser {
  return new MaterialBrowser({
    onOpenFolder: () => {
      void slots.textureBrowserController?.openFolder();
    },
    onSelectTexture: (entryId) => slots.textureBrowserController?.selectTexture(entryId),
  });
}

/**
 * Creates the library controller that fills the material browser.
 *
 * @param deps Face inspector setup dependencies.
 * @param materialBrowser Material browser view.
 * @returns Texture browser controller.
 */
function faceInspectorBrowserControllerCreate(
  deps: FaceInspectorSetupDeps,
  materialBrowser: MaterialBrowser,
): ControllerTextureBrowser {
  const controller = new ControllerTextureBrowser({ browser: materialBrowser });
  controller.setStatusCallback((message) => deps.statusBar?.setLastAction(message));
  return controller;
}

/**
 * Applies a material picked in the browser to the selection and refreshes the
 * face attributes.
 *
 * @param deps Face inspector setup dependencies.
 * @param browserController Texture browser controller.
 * @param assignmentController Texture assignment controller.
 * @param faceInspector Face inspector to refresh.
 */
function faceInspectorMaterialSelectionWire(
  deps: FaceInspectorSetupDeps,
  browserController: ControllerTextureBrowser,
  assignmentController: ControllerTextureAssignment,
  faceInspector: FaceInspector,
): void {
  browserController.setSelectionCallback((entry: TextureBrowserEntry | null) => {
    if (!entry) return;
    assignmentController.onTextureSelected(entry);
    deps.afterSurfaceChange();
    faceInspector.refreshFromSelection();
  });
}
