import { TransformMode } from '@/types/transform_mode.js';
import type { GizmoTransform } from '@/transform/gizmo/gizmo_transform.js';
import type { ControllerViewportToolChrome } from '@/tools/chrome/controller/controller_viewport_tool_chrome.js';
import type { StatusBar } from '@/ui/status/status_bar.js';
import type { LayoutToolEditorSystem } from '@/layout/setup/layout_tool_editor_setup.js';
import { applyTransformModeUi } from '@/layout/setup/layout_transform_mode_ui.js';

/** Late-bound editor parts the transform mode switcher reads and updates. */
export interface LayoutTransformModeSwitcherHost {
  /** Shared transform gizmo whose mode is switched. */
  readonly transformGizmo: GizmoTransform;
  /**
   * Returns whether Edit Mode is active.
   *
   * @returns True while component editing is active.
   */
  isEditModeActive(): boolean;
  /**
   * Returns the tool system that switches object transform tools.
   *
   * @returns Tool system, or null before it exists.
   */
  toolEditorSystemRead(): LayoutToolEditorSystem | null;
  /**
   * Returns the tool chrome that highlights the active transform mode.
   *
   * @returns Tool chrome controller, or null before it exists.
   */
  toolsPaletteControllerRead(): ControllerViewportToolChrome | null;
  /**
   * Returns the status bar that shows the transform mode.
   *
   * @returns Status bar, or null when absent.
   */
  statusBarRead(): StatusBar | null;
  /** Moves the gizmo to the current selection pivot. */
  gizmoPivotUpdate(): void;
  /** Shows or hides the gizmo for the current selection. */
  gizmoVisibilityUpdate(): void;
  /**
   * Shows a status message.
   *
   * @param message Message text.
   */
  showStatusMessage(message: string): void;
}

/**
 * Applies transform modes from the toolbar and keyboard in Object Mode and Edit
 * Mode.
 */
export class LayoutTransformModeSwitcher {
  private readonly host: LayoutTransformModeSwitcherHost;

  /**
   * Creates a switcher over late-bound editor parts.
   *
   * @param host Editor parts the switcher reads and updates.
   */
  constructor(host: LayoutTransformModeSwitcherHost) {
    this.host = host;
  }

  /**
   * Applies a transform mode. In Edit Mode, choosing the active mode again
   * turns the transform widgets off.
   *
   * @param mode Transform mode to apply or toggle.
   */
  transformModeApply(mode: TransformMode): void {
    if (this.host.isEditModeActive()) {
      this.editModeTransformModeToggle(mode);
      return;
    }
    const toolEditorSystem = this.host.toolEditorSystemRead();
    if (toolEditorSystem) {
      if (!toolEditorSystem.switchToTransformMode(mode)) {
        return;
      }
    } else {
      this.host.transformGizmo.setMode(mode);
      this.host.gizmoPivotUpdate();
    }
    this.transformButtonsUpdate();
  }

  /** Updates the tool chrome transform highlight and the status bar mode text. */
  transformButtonsUpdate(): void {
    const mode = this.host.transformGizmo.getMode();
    if (this.host.isEditModeActive()) {
      this.editModeTransformButtonsUpdate(mode);
      return;
    }
    applyTransformModeUi(this.host.toolsPaletteControllerRead(), this.host.statusBarRead(), mode);
  }

  /**
   * Applies or toggles the transform widgets while Edit Mode is active.
   *
   * @param mode Requested mode; Bounds is ignored.
   */
  private editModeTransformModeToggle(mode: TransformMode): void {
    if (mode === TransformMode.BOUNDS) {
      return;
    }
    if (this.host.transformGizmo.getMode() === mode) {
      this.editModeTransformModeOnly(TransformMode.BOUNDS);
      this.host.showStatusMessage('Transform widgets off');
      return;
    }
    this.editModeTransformModeOnly(mode);
  }

  /**
   * Sets the gizmo mode, pivot, visibility and Edit Mode highlight for one
   * mode.
   *
   * @param mode Translate, rotate, scale, or Bounds for widgets off.
   */
  private editModeTransformModeOnly(mode: TransformMode): void {
    this.host.transformGizmo.setMode(mode);
    this.host.gizmoPivotUpdate();
    this.host.gizmoVisibilityUpdate();
    this.editModeTransformButtonsUpdate(mode);
  }

  /**
   * Updates the Edit Mode transform highlight. Bounds clears every highlight so
   * the bar matches the no-widget state.
   *
   * @param mode Active mode, where Bounds means none.
   */
  private editModeTransformButtonsUpdate(mode: TransformMode): void {
    if (mode === TransformMode.BOUNDS) {
      this.host.toolsPaletteControllerRead()?.setActiveTransformMode(TransformMode.BOUNDS);
      return;
    }
    applyTransformModeUi(this.host.toolsPaletteControllerRead(), this.host.statusBarRead(), mode);
  }
}
