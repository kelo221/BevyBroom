import type * as THREE from 'three';
import { EditorToolId } from '@/types/editor_tool_id.js';
import type { KeyboardShortcutAction } from '@/settings/store/settings_types.js';
import type { ManagerSelection } from '@/selection/object/manager_selection.js';
import type { ManagerSnap } from '@/transform/snap/manager_snap.js';
import type { CoordinatorCameraFit } from '@/navigation/camera/coordinator_camera_fit.js';
import type { ControllerViewportToolChrome } from '@/tools/chrome/controller/controller_viewport_tool_chrome.js';
import type { LayoutViewportChromeHost } from '@/layout/setup/layout_viewport_chrome.js';
import type { ViewportEditor } from '@/viewports/core/viewport_editor.js';
import { selectableMeshesCollect } from '@/selection/object/selectable_mesh_filter.js';
import type { SelectionQueryId } from '@/selection/query/selection_query.js';
import { selectionQueryFind } from '@/selection/query/selection_query_registry.js';
import { selectionQueryRun } from '@/selection/query/selection_query_run.js';
import { viewCycleHoveredPane, viewMaximizeHoveredPane } from '@/layout/view_cycle/layout_view_cycle.js';
import type { ShellWindowActions } from '@/layout/shell/actions/shell_window_actions.js';
import type { HandlerSelectionVisibility } from '@/selection/visibility/handler_selection_visibility.js';
import type { HandlerSolidBrushTools } from '@/tools/csg/solid/handler_solid_brush_tools.js';
import type { ClipboardEditCommands } from '@/clipboard/controller/clipboard_edit_commands.js';

/** Late-bound editor parts the main window commands act on. */
export interface ShellWindowActionsLayoutSource {
  /**
   * Returns the layout chrome host of the main window panes.
   *
   * @returns Viewport chrome host.
   */
  viewportChromeHostRead(): LayoutViewportChromeHost;
  /**
   * Returns the camera fit coordinator, or undefined before it exists.
   *
   * @returns Camera fit coordinator.
   */
  cameraFitCoordinatorRead(): CoordinatorCameraFit | undefined;
  /**
   * Returns the tool chrome controller, or null before it exists.
   *
   * @returns Tool chrome controller.
   */
  toolChromeRead(): ControllerViewportToolChrome | null;
  /** Starts play mode from the current camera or the placed spawn. */
  playModeStart(): void;
  /**
   * Returns the Cut, Copy and Paste commands, or null before they exist.
   *
   * @returns Clipboard edit commands.
   */
  clipboardEditCommandsRead(): ClipboardEditCommands | null;
  /**
   * Returns the configured shortcut text of one action.
   *
   * @param action Shortcut action.
   * @returns Shortcut label.
   */
  shortcutLabelRead(action: KeyboardShortcutAction): string;
  /**
   * Returns the solid brush tools, or null before they exist.
   *
   * @returns Brush tools.
   */
  solidBrushToolsRead(): HandlerSolidBrushTools | null;
  /**
   * Returns the Hide, Isolate and Show All commands, or null before they exist.
   *
   * @returns Visibility commands.
   */
  selectionVisibilityRead(): HandlerSelectionVisibility | null;
  /** Object selection the selection commands change. */
  readonly selectionManager: ManagerSelection;
  /** Scene root whose selectable objects Select All picks. */
  readonly worldObject: THREE.Object3D;
  /** Grid size source. */
  readonly snapManager: ManagerSnap;
}

/** Main window commands backed by the viewport layout. */
export class ShellWindowActionsLayout implements ShellWindowActions {
  /**
   * Creates the commands over late-bound layout parts.
   *
   * @param source Editor parts the commands act on.
   */
  constructor(private readonly source: ShellWindowActionsLayoutSource) {}

  /** Selects every selectable object of the scene. */
  selectAll(): void {
    this.source.selectionManager.setSelection(selectableMeshesCollect(this.source.worldObject));
  }

  /** Clears the object selection. */
  selectNone(): void {
    this.source.selectionManager.clearSelection();
  }

  /**
   * Switches the hovered view to the next view kind and frames the selection in
   * it.
   */
  viewCycle(): void {
    viewCycleHoveredPane(this.source.viewportChromeHostRead(), (viewport) => this.viewportFitWhenSelected(viewport));
  }

  /** Maximizes or restores the hovered view. */
  viewMaximize(): void {
    viewMaximizeHoveredPane(this.source.viewportChromeHostRead());
  }

  /** Frames the selection in the hovered view. */
  frameSelection(): void {
    this.source.cameraFitCoordinatorRead()?.onFitToSelection();
  }

  /** Frames the selection in every main window view. */
  frameAll(): void {
    this.source.cameraFitCoordinatorRead()?.onFitAllViewports();
  }

  /** Starts play mode. */
  playStart(): void {
    this.source.playModeStart();
  }

  /** Copies the selection to the clipboard. */
  clipboardCopy(): void {
    void this.source.clipboardEditCommandsRead()?.copy();
  }

  /** Copies the selection to the clipboard and deletes it. */
  clipboardCut(): void {
    void this.source.clipboardEditCommandsRead()?.cut();
  }

  /** Pastes the clipboard under the pointer. */
  clipboardPaste(): void {
    void this.source.clipboardEditCommandsRead()?.paste();
  }

  /** Pastes the clipboard at the position it was copied from. */
  clipboardPasteAtOriginalPosition(): void {
    void this.source.clipboardEditCommandsRead()?.pasteAtOriginalPosition();
  }

  /**
   * Returns whether the selection holds anything to copy or cut.
   *
   * @returns True when something is selected.
   */
  clipboardSelectionHasObjectsIs(): boolean {
    return this.source.clipboardEditCommandsRead()?.selectionHasObjectsIs() ?? false;
  }

  /**
   * Activates one editor tool.
   *
   * @param toolId Tool to activate.
   */
  toolSelect(toolId: EditorToolId): void {
    this.source.toolChromeRead()?.selectTool(toolId);
  }

  /**
   * Returns the active editor tool, or object select before tools exist.
   *
   * @returns Active tool id.
   */
  toolActiveRead(): EditorToolId {
    return this.source.toolChromeRead()?.getActiveTool() ?? EditorToolId.OBJECT;
  }

  /**
   * Returns the grid size.
   *
   * @returns Grid size in meters.
   */
  gridIntervalRead(): number {
    return this.source.snapManager.getInterval();
  }

  /**
   * Sets the grid size.
   *
   * @param interval Grid size in meters.
   */
  gridIntervalSet(interval: number): void {
    this.source.snapManager.setInterval(interval);
  }

  /**
   * Registers a listener told the new grid size after every change.
   *
   * @param listener Called with the new grid size.
   */
  gridIntervalChangeListenerAdd(listener: (interval: number) => void): void {
    this.source.snapManager.onIntervalChanged(listener);
  }

  /**
   * Returns the configured shortcut text of one action.
   *
   * @param action Shortcut action.
   * @returns Shortcut label.
   */
  shortcutLabelRead(action: KeyboardShortcutAction): string {
    return this.source.shortcutLabelRead(action);
  }

  /**
   * Returns the solid brush tools.
   *
   * @returns Brush tools, or null before they exist.
   */
  solidBrushToolsRead(): HandlerSolidBrushTools | null {
    return this.source.solidBrushToolsRead();
  }

  /**
   * Replaces the object selection with the result of a selection query.
   *
   * @param queryId Query to run.
   * @returns Number of selected objects afterwards, zero for an unknown query.
   */
  selectionQueryRun(queryId: SelectionQueryId): number {
    const query = selectionQueryFind(queryId);
    return query ? selectionQueryRun(query, this.source.selectionManager, this.source.worldObject) : 0;
  }

  /**
   * Returns whether any object is selected.
   *
   * @returns True while the object selection is not empty.
   */
  selectionHasObjectsIs(): boolean {
    return this.source.selectionManager.getSelectedObjectCount() > 0;
  }

  /**
   * Returns the Hide, Isolate and Show All commands.
   *
   * @returns Visibility commands, or null before they exist.
   */
  selectionVisibilityRead(): HandlerSelectionVisibility | null {
    return this.source.selectionVisibilityRead();
  }

  /**
   * Frames the selection in one viewport when something is selected.
   *
   * @param viewport Viewport whose camera is fitted.
   */
  private viewportFitWhenSelected(viewport: ViewportEditor): void {
    if (this.source.selectionManager.getAllSelectedObjectsAsArray().length === 0) {
      return;
    }
    this.source.cameraFitCoordinatorRead()?.fitSpecificViewport(viewport);
  }
}
