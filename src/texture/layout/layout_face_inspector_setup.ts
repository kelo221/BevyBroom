import * as THREE from 'three';
import { ManagerSelection } from '@/selection/object/manager_selection.js';
import { CommandStack } from '@/commands/command_stack.js';
import { GridSnap } from '@/transform/snap/grid_snap.js';
import { HandlerKeyboardShortcut } from '@/input/handler_keyboard_shortcut.js';
import { ControllerFaceExtrusion } from '@/tools/face/controller_face_extrusion.js';
import { ControllerUvEditor } from '@/texture/controller/controller_uv_editor.js';
import { ControllerFaceUvTools } from '@/texture/controller/controller_face_uv_tools.js';
import { faceUvShortcutsRegister } from '@/texture/controller/face_uv_shortcut_bindings.js';
import { ControllerTextureBrowser } from '@/texture/controller/controller_texture_browser.js';
import { ControllerTextureAssignment } from '@/texture/controller/controller_texture_assignment.js';
import { HandlerTextureReplace } from '@/texture/replace/handler_texture_replace.js';
import type { MaterialBrowserContextMenuHandlers } from '@/texture/ui/material_browser/material_browser_context_menu.js';
import { ControllerMaterialUsage } from '@/texture/controller/controller_material_usage.js';
import {
  FaceAttributesEditor,
  type FaceAttributesEditorHandlers,
} from '@/texture/ui/face_attributes/face_attributes_editor.js';
import type { FaceAttributesMaterialDescription } from '@/texture/ui/face_attributes/face_attributes_material_row.js';
import { MaterialBrowser } from '@/texture/ui/material_browser/material_browser.js';
import { FaceInspector } from '@/texture/ui/face_inspector/face_inspector.js';
import type { TextureBrowserEntry } from '@/texture/library/texture_browser_entry.js';
import { getTextureMapCache } from '@/texture/library/texture_map_cache.js';
import { StatusBar } from '@/ui/status/status_bar.js';

/** Services the face inspector and its controllers are built from. */
export interface FaceInspectorSetupDeps {
  selectionManager: ManagerSelection;
  faceController: ControllerFaceExtrusion;
  commandStack: CommandStack;
  statusBar: StatusBar | null;
  afterSurfaceChange: () => void;
  /** Grid snap providing UV nudge and rotation steps. */
  gridSnap?: GridSnap | null;
  /** Keyboard handler receiving the face UV shortcuts. */
  keyboardShortcutHandler?: HandlerKeyboardShortcut | null;
  /** Supplies the active viewport camera, or null. */
  activeCameraRead?: (() => THREE.Camera | null) | null;
  /** Shows the Face inspector tab when faces become selected. */
  revealFaceInspector?: (() => void) | null;
  /** Editor world root used by the material usage actions. */
  worldObject?: THREE.Group | null;
  /** Reads whether the Face inspector auto-reveal setting is enabled. */
  isFaceInspectorAutoRevealEnabled?: (() => boolean) | null;
}

/** Face inspector with the controllers that drive it. */
export interface FaceInspectorSetupResult {
  faceInspector: FaceInspector;
  uvEditorController: ControllerUvEditor;
  faceUvToolsController: ControllerFaceUvTools | null;
  textureBrowserController: ControllerTextureBrowser;
  textureAssignmentController: ControllerTextureAssignment;
}

/** Late-bound controller references the views call into after construction. */
interface FaceInspectorControllerSlots {
  textureBrowserController: ControllerTextureBrowser | null;
}

/** Services for the optional face UV tools controller. */
interface FaceUvToolsServices {
  gridSnap: GridSnap | null;
  keyboardShortcutHandler: HandlerKeyboardShortcut | null;
}

/**
 * Builds the docked Face tab: face attributes over the material browser, with
 * the UV, face UV tools, library and assignment controllers wired to selection
 * and undo.
 *
 * @param deps Shared editor services.
 * @returns Face inspector and its controllers.
 */
export function faceInspectorSetup(deps: FaceInspectorSetupDeps): FaceInspectorSetupResult {
  const slots: FaceInspectorControllerSlots = { textureBrowserController: null };
  const parts = faceInspectorPartsCreate(deps, slots);
  slots.textureBrowserController = parts.textureBrowserController;
  parts.uvEditorController.setView(parts.faceAttributesEditor);
  faceInspectorPartsWire(deps, parts);
  parts.faceInspector.refreshFromSelection();
  return {
    faceInspector: parts.faceInspector,
    uvEditorController: parts.uvEditorController,
    faceUvToolsController: parts.faceUvToolsController,
    textureBrowserController: parts.textureBrowserController,
    textureAssignmentController: parts.textureAssignmentController,
  };
}

/** Controllers and views the Face tab is assembled from. */
interface FaceInspectorParts {
  faceInspector: FaceInspector;
  uvEditorController: ControllerUvEditor;
  faceUvToolsController: ControllerFaceUvTools | null;
  textureBrowserController: ControllerTextureBrowser;
  textureAssignmentController: ControllerTextureAssignment;
  faceAttributesEditor: FaceAttributesEditor;
}

/**
 * Creates every controller and view of the Face tab.
 *
 * @param deps Shared editor services.
 * @param slots Late-bound browser controller slot.
 * @returns Inspector parts before they are wired together.
 */
function faceInspectorPartsCreate(
  deps: FaceInspectorSetupDeps,
  slots: FaceInspectorControllerSlots,
): FaceInspectorParts {
  const uvEditorController = faceInspectorUvControllerCreate(deps);
  const faceUvToolsController = faceInspectorUvToolsControllerCreate(deps);
  const textureAssignmentController = faceInspectorAssignmentControllerCreate(deps);
  const faceAttributesEditor = faceInspectorAttributesEditorCreate(
    deps,
    uvEditorController,
    faceUvToolsController,
    slots,
  );
  const materialUsageController = faceInspectorMaterialUsageControllerCreate(deps);
  const materialBrowser = faceInspectorMaterialBrowserCreate(slots, materialUsageController, deps);
  const textureBrowserController = faceInspectorBrowserControllerCreate(deps, materialBrowser);
  const faceInspector = new FaceInspector({
    faceAttributesEditor,
    materialBrowser,
    selectionSource: uvEditorController,
  });
  return {
    faceInspector,
    uvEditorController,
    faceUvToolsController,
    textureBrowserController,
    textureAssignmentController,
    faceAttributesEditor,
  };
}

/**
 * Wires the material selection and face selection callbacks of the assembled
 * parts.
 *
 * @param deps Shared editor services.
 * @param parts Inspector parts to wire.
 */
function faceInspectorPartsWire(deps: FaceInspectorSetupDeps, parts: FaceInspectorParts): void {
  faceInspectorMaterialSelectionWire(
    deps,
    parts.textureBrowserController,
    parts.textureAssignmentController,
    parts.faceInspector,
  );
  faceInspectorSelectionCallbackWire(
    deps,
    parts.faceInspector,
    parts.faceAttributesEditor,
    parts.faceUvToolsController,
  );
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
 * Creates the face UV tools controller when its services are available.
 *
 * @param deps Face inspector setup dependencies.
 * @returns Tools controller, or null without grid snap.
 */
function faceInspectorUvToolsControllerCreate(deps: FaceInspectorSetupDeps): ControllerFaceUvTools | null {
  const services: FaceUvToolsServices = {
    gridSnap: deps.gridSnap ?? null,
    keyboardShortcutHandler: deps.keyboardShortcutHandler ?? null,
  };
  if (!services.gridSnap) {
    return null;
  }
  const controller = faceUvToolsControllerBuild(deps, services);
  controller.setStatusCallback((message) => deps.statusBar?.setLastAction(message));
  controller.setAfterEditCallback(() => deps.afterSurfaceChange());
  if (services.keyboardShortcutHandler) {
    faceUvShortcutsRegister(services.keyboardShortcutHandler, controller);
  }
  return controller;
}

/**
 * Builds the face UV tools controller with its camera and modifier providers.
 *
 * @param deps Face inspector setup dependencies.
 * @param services Resolved tool services.
 * @returns Unwired tools controller.
 */
function faceUvToolsControllerBuild(
  deps: FaceInspectorSetupDeps,
  services: FaceUvToolsServices,
): ControllerFaceUvTools {
  const cameraRead = deps.activeCameraRead ?? (() => null);
  const keyboardHandler = services.keyboardShortcutHandler;
  return new ControllerFaceUvTools(
    deps.selectionManager,
    deps.faceController,
    deps.commandStack,
    services.gridSnap as GridSnap,
    () => faceInspectorCameraDirectionsRead(cameraRead()),
    () => keyboardHandler?.modifiersStateRead() ?? { shift: false, ctrl: false },
  );
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
 * Creates the face attributes editor whose edits go through the UV controllers.
 *
 * @param deps Face inspector setup dependencies.
 * @param controller UV mapping controller.
 * @param uvToolsController Face UV tools controller, or null.
 * @param slots Late-bound browser controller used to describe materials.
 * @returns Face attributes editor.
 */
function faceInspectorAttributesEditorCreate(
  deps: FaceInspectorSetupDeps,
  controller: ControllerUvEditor,
  uvToolsController: ControllerFaceUvTools | null,
  slots: FaceInspectorControllerSlots,
): FaceAttributesEditor {
  return new FaceAttributesEditor(faceAttributesHandlersBuild(deps, controller, uvToolsController), (textureId) =>
    faceInspectorMaterialDescribe(slots.textureBrowserController, textureId),
  );
}

/**
 * Builds the face attributes editor handlers that run every edit and then
 * refresh the surfaces.
 *
 * @param deps Face inspector setup dependencies.
 * @param controller UV mapping controller.
 * @param uvToolsController Face UV tools controller, or null.
 * @returns Editor handlers.
 */
function faceAttributesHandlersBuild(
  deps: FaceInspectorSetupDeps,
  controller: ControllerUvEditor,
  uvToolsController: ControllerFaceUvTools | null,
): FaceAttributesEditorHandlers {
  /**
   * Runs one edit and then refreshes viewport surfaces.
   *
   * @param edit Edit to run.
   */
  const afterEdit = (edit: () => void): void => {
    edit();
    deps.afterSurfaceChange();
  };
  return {
    onAlign: (align) => afterEdit(() => controller.applyAlign(align)),
    onApplyPartialTrs: (fields) => afterEdit(() => controller.applyPartialTrsFields(fields)),
    onRelativeOp: (op) => afterEdit(() => controller.applyRelativeOp(op)),
    onReset: () => afterEdit(() => controller.resetMapping()),
    onFit: (axis) => afterEdit(() => uvToolsController?.fit(axis)),
    onJustify: (side) => afterEdit(() => uvToolsController?.justify(side)),
    onAlignEdge: (mode) => afterEdit(() => uvToolsController?.alignEdge(mode)),
    onFlip: (axis) => afterEdit(() => uvToolsController?.flip(axis)),
    onRotate: (degrees) => afterEdit(() => uvToolsController?.rotate(degrees)),
    onResetFace: () => afterEdit(() => uvToolsController?.resetToFace()),
    onResetWorld: () => afterEdit(() => uvToolsController?.resetToWorld()),
    onShearCommit: (mode, factor) => afterEdit(() => uvToolsController?.shearFromField(mode, factor)),
  };
}

/**
 * Describes a material from the browser controller's library, including the
 * image size once the texture cache has decoded it.
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
  const sizePixels = faceInspectorTextureSizeRead(textureId);
  return {
    displayName: entry.displayName,
    previewObjectUrl: entry.previewObjectUrl,
    ...(sizePixels ? { sizePixels } : {}),
  };
}

/**
 * Reads the decoded pixel size of a cached texture.
 *
 * @param textureId Texture identity.
 * @returns Image size, or null while unknown.
 */
function faceInspectorTextureSizeRead(textureId: string): { width: number; height: number } | null {
  const image = getTextureMapCache().resolve(textureId).image as { width?: number; height?: number } | null;
  if (!image || !image.width || !image.height) {
    return null;
  }
  return { width: image.width, height: image.height };
}

/**
 * Creates the material browser whose actions go through the browser controller.
 *
 * @param slots Late-bound browser controller.
 * @param usageController Material usage finder, or null without a world.
 * @param deps Face inspector setup dependencies.
 * @returns Material browser.
 */
function faceInspectorMaterialBrowserCreate(
  slots: FaceInspectorControllerSlots,
  usageController: ControllerMaterialUsage | null,
  deps: FaceInspectorSetupDeps,
): MaterialBrowser {
  const contextActions =
    usageController && deps.worldObject
      ? faceInspectorMaterialContextActionsCreate(slots, usageController, deps.worldObject, deps)
      : null;
  return new MaterialBrowser({
    onOpenFolder: () => {
      void slots.textureBrowserController?.openFolder();
    },
    onSelectTexture: (entryId) => slots.textureBrowserController?.selectTexture(entryId),
    ...(contextActions ? { contextActions } : {}),
  });
}

/**
 * Builds the right-click actions of the material tiles.
 *
 * @param slots Late-bound browser controller.
 * @param usageController Material usage finder.
 * @param worldObject Scene root searched for brushes.
 * @param deps Face inspector setup dependencies.
 * @returns Tile context actions.
 */
function faceInspectorMaterialContextActionsCreate(
  slots: FaceInspectorControllerSlots,
  usageController: ControllerMaterialUsage,
  worldObject: THREE.Object3D,
  deps: FaceInspectorSetupDeps,
): MaterialBrowserContextMenuHandlers {
  const selectedMaterialIdRead = faceInspectorSelectedMaterialIdReaderCreate(slots);
  const textureReplace = faceInspectorTextureReplaceCreate(deps, worldObject);
  return {
    onSelectFacesUsingMaterial: (entry) => usageController.selectFacesUsingTexture(entry.id),
    onSelectObjectsUsingMaterial: (entry) => usageController.selectObjectsUsingTexture(entry.id),
    onReplaceWithSelectedMaterial: (entry) =>
      faceInspectorMaterialReplace(textureReplace, entry.id, selectedMaterialIdRead(), deps),
    selectedMaterialIdRead,
    onCopyName: (entry) => faceInspectorMaterialNameCopy(entry.displayName, deps),
  };
}

/**
 * Creates a reader of the material selected in the browser.
 *
 * @param slots Late-bound browser controller.
 * @returns Reader returning the selected material id, or ''.
 */
function faceInspectorSelectedMaterialIdReaderCreate(slots: FaceInspectorControllerSlots): () => string {
  return () => slots.textureBrowserController?.getLibrary().getSelectedId() ?? '';
}

/**
 * Creates the material replacement over the editor world.
 *
 * @param deps Face inspector setup dependencies.
 * @param worldObject Scene root searched for brushes.
 * @returns Material replacement.
 */
function faceInspectorTextureReplaceCreate(
  deps: FaceInspectorSetupDeps,
  worldObject: THREE.Object3D,
): HandlerTextureReplace {
  return new HandlerTextureReplace({
    commandStack: deps.commandStack,
    worldObject,
    selectionManager: deps.selectionManager,
    afterReplace: () => deps.afterSurfaceChange(),
  });
}

/**
 * Replaces a material with the selected one, in the selected objects when
 * anything is selected and everywhere otherwise, and reports the face count.
 *
 * @param textureReplace Material replacement.
 * @param findTextureId Material to replace.
 * @param replaceTextureId Material painted instead.
 * @param deps Face inspector setup dependencies for status feedback.
 */
function faceInspectorMaterialReplace(
  textureReplace: HandlerTextureReplace,
  findTextureId: string,
  replaceTextureId: string,
  deps: FaceInspectorSetupDeps,
): void {
  if (replaceTextureId === '') {
    return;
  }
  const scope = deps.selectionManager.getSelectedObjectCount() > 0 ? 'selection' : 'all';
  const faceCount = textureReplace.replace(findTextureId, replaceTextureId, scope);
  deps.statusBar?.setLastAction(`Replaced the material of ${faceCount} face(s)`);
}

/**
 * Copies a material name to the system clipboard.
 *
 * @param displayName Name to copy.
 * @param deps Face inspector setup dependencies for status feedback.
 */
function faceInspectorMaterialNameCopy(displayName: string, deps: FaceInspectorSetupDeps): void {
  void navigator.clipboard?.writeText(displayName).then(
    () => deps.statusBar?.setLastAction(`Copied "${displayName}"`),
    () => deps.statusBar?.setLastAction(`Copy failed for "${displayName}"`),
  );
}

/**
 * Creates the material usage controller when the world is available.
 *
 * @param deps Face inspector setup dependencies.
 * @returns Usage controller, or null without a world.
 */
function faceInspectorMaterialUsageControllerCreate(deps: FaceInspectorSetupDeps): ControllerMaterialUsage | null {
  if (!deps.worldObject) {
    return null;
  }
  const controller = new ControllerMaterialUsage(deps.worldObject, deps.selectionManager, deps.faceController);
  controller.setStatusCallback((message) => deps.statusBar?.setLastAction(message));
  return controller;
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

/**
 * Wires the face selection callback: auto-reveals the Face tab when faces
 * become selected, refreshes the attributes, and refreshes UV tool status.
 *
 * @param deps Face inspector setup dependencies.
 * @param faceInspector Face inspector to refresh.
 * @param editor Face attributes editor receiving status.
 * @param uvToolsController Face UV tools controller, or null.
 */
function faceInspectorSelectionCallbackWire(
  deps: FaceInspectorSetupDeps,
  faceInspector: FaceInspector,
  editor: FaceAttributesEditor,
  uvToolsController: ControllerFaceUvTools | null,
): void {
  deps.faceController.setFaceSelectionChangedCallback((faces) => {
    faceInspectorAutoRevealRun(deps, faces.length);
    faceInspector.refreshFromSelection();
    editor.setUvToolStatus(uvToolsController?.readSelectionStatus() ?? null);
    editor.setShearValues(
      uvToolsController?.readSharedShear('u-by-v') ?? null,
      uvToolsController?.readSharedShear('v-by-u') ?? null,
    );
  });
}

/**
 * Reveals the Face inspector tab on the first selected face when the
 * auto-reveal setting allows it.
 *
 * @param deps Face inspector setup dependencies.
 * @param selectedFaceCount Current selected face count.
 */
function faceInspectorAutoRevealRun(deps: FaceInspectorSetupDeps, selectedFaceCount: number): void {
  if (selectedFaceCount === 0) {
    return;
  }
  if (deps.isFaceInspectorAutoRevealEnabled && !deps.isFaceInspectorAutoRevealEnabled()) {
    return;
  }
  deps.revealFaceInspector?.();
}

/**
 * Reads world-space camera right and up directions from a camera basis.
 *
 * @param camera Active camera, or null.
 * @returns Unit camera directions, or null without a camera.
 */
function faceInspectorCameraDirectionsRead(camera: THREE.Camera | null): {
  right: THREE.Vector3;
  up: THREE.Vector3;
} | null {
  if (!camera) {
    return null;
  }
  camera.updateMatrixWorld();
  const basis = camera.matrixWorld.elements;
  const right = new THREE.Vector3(basis[0], basis[1], basis[2]).normalize();
  const up = new THREE.Vector3(basis[4], basis[5], basis[6]).normalize();
  if (right.lengthSq() < 1e-12 || up.lengthSq() < 1e-12) {
    return null;
  }
  return { right, up };
}
