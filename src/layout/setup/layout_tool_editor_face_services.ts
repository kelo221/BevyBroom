import type { EditorServices } from '@/editor/window/editor_services.js';
import type { CoordinatorFaceMode } from '@/tools/face/coordinator_face_mode.js';

/** Reads the face mode coordinator, or null before it exists. */
export type LayoutToolEditorFaceCoordinatorRead = () => CoordinatorFaceMode | null;

/** Editor services of face picking, painting and texture application. */
export type LayoutToolEditorFacePointerServices = Pick<
  EditorServices,
  | 'enterFaceSelectionMode'
  | 'leaveFaceSelectionMode'
  | 'beginFaceSelectPointerDown'
  | 'beginFaceSelectSecondaryPress'
  | 'continueFaceSelectPointerMove'
  | 'endFaceSelectPointerUp'
  | 'isFaceSelectStrokeActive'
  | 'hasFaceSelection'
>;

/** Editor services of the single-use face UV transform. */
export type LayoutToolEditorFaceUvTransformServices = Pick<
  EditorServices,
  | 'beginFaceUvTransform'
  | 'updateFaceUvTransform'
  | 'endFaceUvTransform'
  | 'cancelFaceUvTransform'
  | 'isFaceUvTransformActive'
>;

/**
 * Builds every face mode editor service over the face mode coordinator.
 *
 * @param faceCoordinatorRead Reads the face mode coordinator.
 * @param getPointerOwnerDocument Document that owns the last pointer sample.
 * @returns Face pointer and UV transform services.
 */
export function layoutToolEditorFaceServicesCreate(
  faceCoordinatorRead: LayoutToolEditorFaceCoordinatorRead,
  getPointerOwnerDocument: () => Document | null,
): LayoutToolEditorFacePointerServices & LayoutToolEditorFaceUvTransformServices {
  return {
    ...layoutToolEditorFacePointerServicesCreate(faceCoordinatorRead, getPointerOwnerDocument),
    ...layoutToolEditorFaceUvTransformServicesCreate(faceCoordinatorRead),
  };
}

/**
 * Builds the face pick, paint and texture application services.
 *
 * @param read Reads the face mode coordinator.
 * @param ownerDocumentRead Document that owns the last pointer sample.
 * @returns Face pointer services.
 */
function layoutToolEditorFacePointerServicesCreate(
  read: LayoutToolEditorFaceCoordinatorRead,
  ownerDocumentRead: () => Document | null,
): LayoutToolEditorFacePointerServices {
  return {
    enterFaceSelectionMode: () => read()?.enterFaceSelectionModeFromTool(),
    leaveFaceSelectionMode: () => read()?.leaveFaceSelectionModeFromTool(),
    beginFaceSelectPointerDown: (clientX, clientY, isShiftPressed, isCtrlPressed) =>
      read()?.beginFaceSelectPointerDown(clientX, clientY, isShiftPressed, isCtrlPressed, ownerDocumentRead()) === true,
    beginFaceSelectSecondaryPress: (clientX, clientY) =>
      read()?.beginFaceSelectSecondaryPress(clientX, clientY, ownerDocumentRead()) === true,
    continueFaceSelectPointerMove: (clientX, clientY, buttons) =>
      read()?.continueFaceSelectPointerMove(clientX, clientY, buttons),
    endFaceSelectPointerUp: () => read()?.endFaceSelectPointerUp(),
    isFaceSelectStrokeActive: () => read()?.isFaceSelectStrokeActive() === true,
    hasFaceSelection: () => (read()?.getFaceExtrusionController().getSelectedFaceCount() ?? 0) > 0,
  };
}

/**
 * Builds the single-use face UV transform services.
 *
 * @param read Reads the face mode coordinator.
 * @returns Face UV transform services.
 */
function layoutToolEditorFaceUvTransformServicesCreate(
  read: LayoutToolEditorFaceCoordinatorRead,
): LayoutToolEditorFaceUvTransformServices {
  return {
    beginFaceUvTransform: (mode, clientX, clientY, camera, pickElement) =>
      read()?.beginSingleUseUvTransform(mode, clientX, clientY, camera, pickElement) === true,
    updateFaceUvTransform: (clientX, clientY, camera, pickElement, isShiftPressed) =>
      read()?.updateSingleUseUvTransform(clientX, clientY, camera, pickElement, isShiftPressed),
    endFaceUvTransform: () => read()?.endSingleUseUvTransform() === true,
    cancelFaceUvTransform: () => read()?.cancelUvTransformIfActive(),
    isFaceUvTransformActive: () => read()?.isUvTransformActive() === true,
  };
}
