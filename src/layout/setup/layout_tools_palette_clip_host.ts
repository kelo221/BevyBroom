import type * as THREE from 'three';
import type { CommandStack } from '@/commands/command_stack.js';
import type { CoordinatorEditMode } from '@/edit/coordinator/coordinator_edit_mode.js';
import type { HandlerKeyboardShortcut } from '@/input/handler_keyboard_shortcut.js';
import type { LayoutToolEditorSystem } from '@/layout/setup/layout_tool_editor_types.js';
import type { CoordinatorShadingMode } from '@/navigation/camera/coordinator_shading_mode.js';
import type { ManagerSelection } from '@/selection/object/manager_selection.js';
import type { ControllerSelectionVisual } from '@/selection/object/controller_selection_visual.js';
import type { ToolClipPlane } from '@/tools/clip_plane/tool_clip_plane.js';
import type { ControllerViewportToolChrome } from '@/tools/chrome/controller/controller_viewport_tool_chrome.js';
import type { ViewportToolChromeDocking } from '@/tools/chrome/host/viewport_tool_chrome_docking.js';
import type { CoordinatorFaceMode } from '@/tools/face/coordinator_face_mode.js';
import type { HandlerGridOrientation } from '@/tools/grid/handler_grid_orientation.js';
import type { BridgeTransformInteraction } from '@/tools/bridge/bridge_transform_interaction.js';
import type { PolicyEditorOverlay } from '@/tools/overlay/policy_editor_overlay.js';
import type { RegistryModalToolSession } from '@/tools/session/registry_modal_tool_session.js';
import type { GridSnap } from '@/transform/snap/grid_snap.js';
import type { HandlerTransform } from '@/transform/core/handler_transform.js';
import type { ObjectApplyTransformKind } from '@/types/object_apply_transform_kind.js';
import type { TransformMode } from '@/types/transform_mode.js';
import type { ViewportEditor } from '@/viewports/core/viewport_editor.js';

/** Layout callbacks used to build tool-chrome and clip wiring options. */
export interface LayoutToolsPaletteClipHost {
  worldObject: THREE.Group;
  commandStack: CommandStack;
  selectionManager: ManagerSelection;
  gridSnap: GridSnap;
  clipPlaneTool: ToolClipPlane;
  faceModeCoordinator: CoordinatorFaceMode;
  shellElements: { toolChromeDocking: ViewportToolChromeDocking };
  detachedViewportWindow: { getViewports(): readonly ViewportEditor[] };
  keyboardShortcutHandler: HandlerKeyboardShortcut;
  shadingModeCoordinator: CoordinatorShadingMode;
  editorOverlayPolicy: PolicyEditorOverlay;
  modalToolSessionRegistry: RegistryModalToolSession;
  toolEditorSystem: LayoutToolEditorSystem | null;
  gridOrientationHandler: HandlerGridOrientation | null;
  editModeCoordinator: CoordinatorEditMode | null;
  transformInteractionBridge: BridgeTransformInteraction;
  transformHandler: HandlerTransform;
  selectionVisualController: ControllerSelectionVisual;
  toolsPaletteController: ControllerViewportToolChrome | null;
  shapeDrawSetup: { shapeSettingChanged(): void };
  /**
   * Shows a status bar message.
   *
   * @param message Status text.
   */
  showStatusMessage(message: string): void;
  /** Syncs world selectables to viewports. */
  syncPrimitivesToViewports(): void;
  /** Refreshes the outliner panel. */
  refreshOutliner(): void;
  /** Refreshes tool chrome and hides gizmos while clipping. */
  onClipToolStateChanged(): void;
  /** Cancels the clip tool and returns to object select. */
  onClipCancel(): void;
  /**
   * Activates a transform mode.
   *
   * @param mode Transform mode.
   */
  onTransformMode(mode: TransformMode): void;
  /** Opens the floating texture browser holding the face inspector. */
  faceInspectorReveal(): void;
  /**
   * Returns whether Edit Mode is active.
   *
   * @returns True while component editing is live.
   */
  isEditModeActive(): boolean;
  /** Clears permanent transform widgets when entering Edit Mode. */
  applyEditModeDefaultNoTransformWidget(): void;
  /** Shows or hides transform gizmos. */
  updateGizmoVisibility(): void;
  /** Updates the gizmo pivot to the selection center. */
  updateGizmoPivot(): void;
  /** Rebuilds CAD size dimensions for the current selection. */
  refreshCadRulersFromSelection(): void;
  /**
   * Runs Object → Apply from Edit Mode chrome.
   *
   * @param kind Apply kind.
   */
  applyObjectTransformsFromChrome(kind: ObjectApplyTransformKind): void;
  /** Builds a convex brush around the selected brushes. */
  hullBrushesFromChrome(): void;
  /** Updates tool chrome transform highlights. */
  updateTransformButtons(): void;
  /**
   * Returns a primary scene for tools that need a single scene root.
   *
   * @returns Host scene.
   */
  getPrimaryScene(): THREE.Scene;
  /**
   * Returns every interactive viewport instance.
   *
   * @returns Interactive viewports.
   */
  getAllInteractiveViewports(): ViewportEditor[];
  /**
   * Returns every live viewport instance.
   *
   * @returns Live viewports.
   */
  getAllLiveViewports(): ViewportEditor[];
}
