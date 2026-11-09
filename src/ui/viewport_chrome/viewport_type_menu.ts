import type { ToolbarMenuEntry } from '@/ui/menu/menu_types.js';
import type { ShadingMode } from '@/types/shading_mode.js';
import type { ViewportKind } from '@/viewports/core/viewport_kind.js';
import {
  VIEWPORT_VIEW_CHOICES_2D,
  VIEWPORT_VIEW_CHOICES_3D,
  viewportViewChoiceIsCurrent,
  type ViewportViewChoice,
} from './viewport_view_choices.js';

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
  /** Whether the menu offers Play from here. */
  readonly playFromHereAvailable: boolean;
}

/** Callbacks run by the rows of a viewport view menu. */
export interface ViewportViewMenuActions {
  /**
   * Switches the viewport to a view kind and, when given, its shading mode.
   *
   * @param choice Chosen view.
   */
  onViewChoiceSelect(choice: ViewportViewChoice): void;
  /** Shows or hides content and brush wireframes. */
  onContentWireframesToggle(): void;
  /** Shows or hides the projected surface grid. */
  onProjectedGridToggle(): void;
  /** Frames the selection in the viewport. */
  onFit(): void;
  /** Maximizes the viewport or restores the layout. */
  onMaximizeToggle(): void;
  /** Starts play mode from the viewport camera. */
  onPlayFromHere(): void;
}

/** Label of the view menu row that frames the selection. */
export const VIEWPORT_VIEW_MENU_FIT_LABEL = 'Fit to Selection';

/** Label of the view menu row that maximizes or restores the viewport. */
export const VIEWPORT_VIEW_MENU_MAXIMIZE_LABEL = 'Maximize Viewport';

/** Label of the view menu row that toggles content and brush wireframes. */
export const VIEWPORT_VIEW_MENU_WIREFRAMES_LABEL = 'Content and Brush Wireframes';

/** Label of the view menu row that toggles the projected surface grid. */
export const VIEWPORT_VIEW_MENU_PROJECTED_GRID_LABEL = 'Projected Surface Grid';

/** Label of the view menu row that starts play mode from the viewport camera. */
export const VIEWPORT_VIEW_MENU_PLAY_FROM_HERE_LABEL = 'Play from here';

/**
 * Builds the full view menu of a viewport: 2D views, 3D views with their
 * shading, render toggles, Fit to Selection and Maximize, then Play from here
 * when the state offers it.
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
    ...viewportViewMenuChoiceEntriesBuild(VIEWPORT_VIEW_CHOICES_2D, stateRead, actions),
    { kind: 'separator' },
    ...viewportViewMenuChoiceEntriesBuild(VIEWPORT_VIEW_CHOICES_3D, stateRead, actions),
    { kind: 'separator' },
    ...viewportViewMenuRenderToggleEntriesBuild(stateRead, actions),
    { kind: 'separator' },
    ...viewportViewMenuLayoutEntriesBuild(stateRead, actions),
    ...viewportViewMenuPlayEntriesBuild(stateRead, actions),
  ];
}

/**
 * Builds one row per view choice, checked while it is the current view.
 *
 * @param choices View choices in menu order.
 * @param stateRead Returns the live viewport state.
 * @param actions Callbacks of the rows.
 * @returns View choice rows.
 */
function viewportViewMenuChoiceEntriesBuild(
  choices: readonly ViewportViewChoice[],
  stateRead: () => ViewportViewMenuState,
  actions: ViewportViewMenuActions,
): ToolbarMenuEntry[] {
  return choices.map((choice) => ({
    label: choice.label,
    isChecked: () => viewportViewChoiceIsCurrent(choice, stateRead().kind, stateRead().shadingMode),
    onClick: () => actions.onViewChoiceSelect(choice),
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

/**
 * Builds the Fit to Selection and checked Maximize Viewport rows.
 *
 * @param stateRead Returns the live viewport state.
 * @param actions Callbacks of the rows.
 * @returns Layout rows.
 */
function viewportViewMenuLayoutEntriesBuild(
  stateRead: () => ViewportViewMenuState,
  actions: ViewportViewMenuActions,
): ToolbarMenuEntry[] {
  return [
    { label: VIEWPORT_VIEW_MENU_FIT_LABEL, shortcut: 'F', onClick: () => actions.onFit() },
    {
      label: VIEWPORT_VIEW_MENU_MAXIMIZE_LABEL,
      isChecked: () => stateRead().maximized,
      onClick: () => actions.onMaximizeToggle(),
    },
  ];
}

/**
 * Builds the separated Play from here row, or nothing when the state does not
 * offer it.
 *
 * @param stateRead Returns the live viewport state.
 * @param actions Callbacks of the rows.
 * @returns Play rows, possibly empty.
 */
function viewportViewMenuPlayEntriesBuild(
  stateRead: () => ViewportViewMenuState,
  actions: ViewportViewMenuActions,
): ToolbarMenuEntry[] {
  if (!stateRead().playFromHereAvailable) {
    return [];
  }
  return [
    { kind: 'separator' },
    { label: VIEWPORT_VIEW_MENU_PLAY_FROM_HERE_LABEL, onClick: () => actions.onPlayFromHere() },
  ];
}
