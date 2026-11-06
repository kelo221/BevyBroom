import type { ToolbarMenuEntry } from '@/ui/menu/menu_types.js';
import type { ShadingMode } from '@/types/shading_mode.js';
import { VIEWPORT_KIND_MENU_ORDER, ViewportKind, getViewportKindDisplayLabel } from '@/viewports/core/viewport_kind.js';
import { VIEWPORT_SHADING_CHOICES } from './viewport_shading_choices.js';

/** Live state of one viewport shown by the checks of its view menu. */
export interface ViewportViewMenuState {
  /** Active view kind. */
  readonly kind: ViewportKind;
  /** Active shading mode. */
  readonly shadingMode: ShadingMode;
  /** Whether content and brush wireframes are shown. */
  readonly contentWireframesActive: boolean;
  /** Whether the projected surface grid is shown. */
  readonly projectedGridActive: boolean;
  /** Whether the viewport fills the workspace. */
  readonly maximized: boolean;
}

/** Callbacks run by the rows of a viewport view menu. */
export interface ViewportViewMenuActions {
  /**
   * Switches the viewport to another view kind.
   *
   * @param kind Chosen view kind.
   */
  onKindSelect(kind: ViewportKind): void;
  /**
   * Applies a shading mode.
   *
   * @param mode Chosen shading mode.
   */
  onShadingSelect(mode: ShadingMode): void;
  /** Shows or hides content and brush wireframes. */
  onContentWireframesToggle(): void;
  /** Shows or hides the projected surface grid. */
  onProjectedGridToggle(): void;
  /** Frames the selection in the viewport. */
  onFit(): void;
  /** Maximizes the viewport or restores the layout. */
  onMaximizeToggle(): void;
}

/** Label of the view menu row that frames the selection. */
export const VIEWPORT_VIEW_MENU_FIT_LABEL = 'Fit to Selection';

/** Label of the view menu row that maximizes or restores the viewport. */
export const VIEWPORT_VIEW_MENU_MAXIMIZE_LABEL = 'Maximize Viewport';

/** Label of the view menu row that toggles content and brush wireframes. */
export const VIEWPORT_VIEW_MENU_WIREFRAMES_LABEL = 'Content and Brush Wireframes';

/** Label of the view menu row that toggles the projected surface grid. */
export const VIEWPORT_VIEW_MENU_PROJECTED_GRID_LABEL = 'Projected Surface Grid';

/**
 * Builds menu entries for switching a viewport pane kind, with a check mark on
 * the active kind.
 *
 * @param currentKind Currently active kind for the pane.
 * @param onSelect Invoked when the user chooses a kind.
 * @returns Menu entries for MenuPanel.
 */
function buildViewportTypeMenuEntries(
  currentKind: ViewportKind,
  onSelect: (kind: ViewportKind) => void,
): ToolbarMenuEntry[] {
  return VIEWPORT_KIND_MENU_ORDER.map((kind) => ({
    label: getViewportKindDisplayLabel(kind),
    onClick: () => onSelect(kind),
    isChecked: () => kind === currentKind,
  }));
}

/**
 * Builds the full view menu of a viewport: view kinds, shading modes, render
 * toggles, then Fit to Selection and Maximize.
 *
 * @param stateRead Returns the live viewport state for the check marks.
 * @param actions Callbacks of the rows.
 * @returns Menu entries for MenuPanel.
 */
export function buildViewportViewMenuEntries(
  stateRead: () => ViewportViewMenuState,
  actions: ViewportViewMenuActions,
): ToolbarMenuEntry[] {
  return [
    ...buildViewportTypeMenuEntries(stateRead().kind, (kind) => actions.onKindSelect(kind)),
    { kind: 'separator' },
    ...viewportViewMenuShadingEntriesBuild(stateRead, actions),
    { kind: 'separator' },
    ...viewportViewMenuRenderToggleEntriesBuild(stateRead, actions),
    { kind: 'separator' },
    { label: VIEWPORT_VIEW_MENU_FIT_LABEL, shortcut: 'F', onClick: () => actions.onFit() },
    {
      label: VIEWPORT_VIEW_MENU_MAXIMIZE_LABEL,
      isChecked: () => stateRead().maximized,
      onClick: () => actions.onMaximizeToggle(),
    },
  ];
}

/**
 * Builds one checked row per shading mode.
 *
 * @param stateRead Returns the live viewport state.
 * @param actions Callbacks of the rows.
 * @returns Shading rows.
 */
function viewportViewMenuShadingEntriesBuild(
  stateRead: () => ViewportViewMenuState,
  actions: ViewportViewMenuActions,
): ToolbarMenuEntry[] {
  return VIEWPORT_SHADING_CHOICES.map((choice) => ({
    label: choice.label,
    isChecked: () => stateRead().shadingMode === choice.mode,
    onClick: () => actions.onShadingSelect(choice.mode),
  }));
}

/**
 * Builds the checked wireframe and projected grid toggle rows.
 *
 * @param stateRead Returns the live viewport state.
 * @param actions Callbacks of the rows.
 * @returns Render toggle rows.
 */
function viewportViewMenuRenderToggleEntriesBuild(
  stateRead: () => ViewportViewMenuState,
  actions: ViewportViewMenuActions,
): ToolbarMenuEntry[] {
  return [
    {
      label: VIEWPORT_VIEW_MENU_WIREFRAMES_LABEL,
      isChecked: () => stateRead().contentWireframesActive,
      onClick: () => actions.onContentWireframesToggle(),
    },
    {
      label: VIEWPORT_VIEW_MENU_PROJECTED_GRID_LABEL,
      isChecked: () => stateRead().projectedGridActive,
      onClick: () => actions.onProjectedGridToggle(),
    },
  ];
}
