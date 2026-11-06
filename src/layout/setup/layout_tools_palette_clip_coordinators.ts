import { CoordinatorEditMode } from '@/edit/coordinator/coordinator_edit_mode.js';
import { CoordinatorEditorOrientation } from '@/navigation/orientation/coordinator_editor_orientation.js';
import { HandlerGridOrientation } from '@/tools/grid/handler_grid_orientation.js';
import type { LayoutToolsPaletteClipHost } from './layout_tools_palette_clip_host.js';

/**
 * Builds the Edit Mode coordinator for tool chrome.
 *
 * @param host Layout callbacks used by the coordinator.
 * @returns Edit Mode coordinator.
 */
export function layoutToolsPaletteEditModeCoordinatorCreate(host: LayoutToolsPaletteClipHost): CoordinatorEditMode {
  return new CoordinatorEditMode({
    getPrimaryScene: () => host.getPrimaryScene(),
    getSelectedObjects: () => host.selectionManager.getAllSelectedObjectsAsArray(),
    getViewports: () => host.getAllInteractiveViewports(),
    showStatusMessage: (message) => host.showStatusMessage(message),
    getCommandStack: () => host.commandStack,
  });
}

/**
 * Builds the independent grid and camera orientation coordinator.
 *
 * @param host Layout callbacks used by the coordinator.
 * @returns Orientation coordinator.
 */
export function layoutToolsPaletteEditorOrientationCoordinatorCreate(
  host: LayoutToolsPaletteClipHost,
): CoordinatorEditorOrientation {
  return new CoordinatorEditorOrientation({
    getViewports: () => host.getAllLiveViewports(),
    showStatusMessage: (message) => host.showStatusMessage(message),
  });
}

/**
 * Builds the grid orientation pick handler.
 *
 * @param host Layout callbacks used by the handler.
 * @param orientationCoordinator Live orientation coordinator.
 * @returns Grid orientation handler.
 */
export function layoutToolsPaletteGridOrientationHandlerCreate(
  host: LayoutToolsPaletteClipHost,
  orientationCoordinator: CoordinatorEditorOrientation,
): HandlerGridOrientation {
  return new HandlerGridOrientation({
    worldObject: host.worldObject,
    orientationCoordinator,
    getViewports: () => host.getAllInteractiveViewports(),
    getPrimaryScene: () => host.getPrimaryScene(),
    showStatusMessage: (message) => host.showStatusMessage(message),
    onPickModeChanged: (mode) => host.toolsPaletteController?.setActiveGridPickMode(mode),
    isShiftPressed: () => host.toolEditorSystem?.editorWindow.getServices()?.isShiftPressed() === true,
  });
}
