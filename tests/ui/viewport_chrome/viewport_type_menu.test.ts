import { describe, expect, it, vi } from 'vitest';
import {
  VIEWPORT_VIEW_MENU_FIT_LABEL,
  VIEWPORT_VIEW_MENU_MAXIMIZE_LABEL,
  VIEWPORT_VIEW_MENU_PLAY_FROM_HERE_LABEL,
  VIEWPORT_VIEW_MENU_PROJECTED_GRID_LABEL,
  VIEWPORT_VIEW_MENU_WIREFRAMES_LABEL,
  buildViewportViewMenuEntries,
  type ViewportViewMenuActions,
  type ViewportViewMenuState,
} from '@/ui/viewport_chrome/viewport_type_menu.js';
import { VIEWPORT_VIEW_CHOICES_2D, VIEWPORT_VIEW_CHOICES_3D } from '@/ui/viewport_chrome/viewport_view_choices.js';
import { isMenuAction, type ToolbarMenuAction, type ToolbarMenuEntry } from '@/ui/menu/menu_types.js';
import { ShadingMode } from '@/types/shading_mode.js';
import { ViewportKind } from '@/viewports/core/viewport_kind.js';

/** Mutable form of the view menu state for the tests. */
type ViewportTypeMenuTestState = { -readonly [Key in keyof ViewportViewMenuState]: ViewportViewMenuState[Key] };

/**
 * Creates view menu actions whose every callback is a spy.
 *
 * @returns Spy actions.
 */
function viewportTypeMenuTestActionsCreate(): ViewportViewMenuActions {
  return {
    onViewChoiceSelect: vi.fn(),
    onContentWireframesToggle: vi.fn(),
    onProjectedGridToggle: vi.fn(),
    onFit: vi.fn(),
    onMaximizeToggle: vi.fn(),
    onPlayFromHere: vi.fn(),
  };
}

/**
 * Returns the action row with a label.
 *
 * @param entries Menu entries.
 * @param label Row label.
 * @returns Action row.
 */
function viewportTypeMenuTestRowRead(entries: readonly ToolbarMenuEntry[], label: string): ToolbarMenuAction {
  const row = entries.find((entry): entry is ToolbarMenuAction => isMenuAction(entry) && entry.label === label);
  if (!row) {
    throw new Error(`Row ${label} not found`);
  }
  return row;
}

/**
 * Lists the labels of the action rows, with separators as "-".
 *
 * @param entries Menu entries.
 * @returns Row labels in menu order.
 */
function viewportTypeMenuTestLabelsRead(entries: readonly ToolbarMenuEntry[]): string[] {
  return entries.map((entry) => (isMenuAction(entry) ? entry.label : '-'));
}

/**
 * Builds a mutable viewport state for the menu checks.
 *
 * @param kind View kind of the state.
 * @param playFromHereAvailable Whether the state offers Play from here.
 * @returns Viewport state with solid shading.
 */
function viewportTypeMenuTestStateCreate(
  kind: ViewportKind,
  playFromHereAvailable: boolean,
): ViewportTypeMenuTestState {
  return {
    kind,
    shadingMode: ShadingMode.SOLID,
    contentWireframesActive: true,
    projectedGridActive: false,
    maximized: false,
    playFromHereAvailable,
  };
}

/**
 * Returns the labels of the 3D rows checked for a state.
 *
 * @param entries Menu entries.
 * @returns Checked 3D row labels.
 */
function viewportTypeMenuTestChecked3dLabelsRead(entries: readonly ToolbarMenuEntry[]): string[] {
  return VIEWPORT_VIEW_CHOICES_3D.map((choice) => viewportTypeMenuTestRowRead(entries, choice.label))
    .filter((row) => row.isChecked?.() === true)
    .map((row) => row.label);
}

describe('buildViewportViewMenuEntries', () => {
  it('lists 2D views, 3D views, render toggles, fit and maximize in sections', () => {
    const state = viewportTypeMenuTestStateCreate(ViewportKind.TOP, false);
    const entries = buildViewportViewMenuEntries(() => state, viewportTypeMenuTestActionsCreate());
    expect(viewportTypeMenuTestLabelsRead(entries)).toEqual([
      ...VIEWPORT_VIEW_CHOICES_2D.map((choice) => choice.label),
      '-',
      ...VIEWPORT_VIEW_CHOICES_3D.map((choice) => choice.label),
      '-',
      VIEWPORT_VIEW_MENU_WIREFRAMES_LABEL,
      VIEWPORT_VIEW_MENU_PROJECTED_GRID_LABEL,
      '-',
      VIEWPORT_VIEW_MENU_FIT_LABEL,
      VIEWPORT_VIEW_MENU_MAXIMIZE_LABEL,
    ]);
  });

  it('ends with a separated Play from here row only when the state offers it', () => {
    const state = viewportTypeMenuTestStateCreate(ViewportKind.PERSPECTIVE, true);
    const labels = viewportTypeMenuTestLabelsRead(
      buildViewportViewMenuEntries(() => state, viewportTypeMenuTestActionsCreate()),
    );
    expect(labels.slice(-2)).toEqual(['-', VIEWPORT_VIEW_MENU_PLAY_FROM_HERE_LABEL]);
    state.playFromHereAvailable = false;
    const labelsWithoutPlay = viewportTypeMenuTestLabelsRead(
      buildViewportViewMenuEntries(() => state, viewportTypeMenuTestActionsCreate()),
    );
    expect(labelsWithoutPlay).not.toContain(VIEWPORT_VIEW_MENU_PLAY_FROM_HERE_LABEL);
  });

  it('checks the 3D row of the perspective shading and no 2D row', () => {
    const state = viewportTypeMenuTestStateCreate(ViewportKind.PERSPECTIVE, false);
    const entries = buildViewportViewMenuEntries(() => state, viewportTypeMenuTestActionsCreate());
    VIEWPORT_VIEW_CHOICES_3D.forEach((choice) => {
      state.shadingMode = choice.shadingMode ?? ShadingMode.SOLID;
      expect(viewportTypeMenuTestChecked3dLabelsRead(entries)).toEqual([choice.label]);
    });
    VIEWPORT_VIEW_CHOICES_2D.forEach((choice) => {
      expect(viewportTypeMenuTestRowRead(entries, choice.label).isChecked?.()).toBe(false);
    });
  });

  it('checks the 2D row of the pane kind and no 3D row', () => {
    const state = viewportTypeMenuTestStateCreate(ViewportKind.FRONT, false);
    const entries = buildViewportViewMenuEntries(() => state, viewportTypeMenuTestActionsCreate());
    VIEWPORT_VIEW_CHOICES_2D.forEach((choice) => {
      state.kind = choice.kind;
      const checked = VIEWPORT_VIEW_CHOICES_2D.filter(
        (candidate) => viewportTypeMenuTestRowRead(entries, candidate.label).isChecked?.() === true,
      );
      expect(checked).toEqual([choice]);
      expect(viewportTypeMenuTestChecked3dLabelsRead(entries)).toEqual([]);
    });
  });

  it('checks the render toggles and maximize from the live state', () => {
    const state = viewportTypeMenuTestStateCreate(ViewportKind.SIDE, false);
    const entries = buildViewportViewMenuEntries(() => state, viewportTypeMenuTestActionsCreate());
    state.maximized = true;
    state.projectedGridActive = true;
    state.contentWireframesActive = false;
    expect(viewportTypeMenuTestRowRead(entries, VIEWPORT_VIEW_MENU_MAXIMIZE_LABEL).isChecked?.()).toBe(true);
    expect(viewportTypeMenuTestRowRead(entries, VIEWPORT_VIEW_MENU_PROJECTED_GRID_LABEL).isChecked?.()).toBe(true);
    expect(viewportTypeMenuTestRowRead(entries, VIEWPORT_VIEW_MENU_WIREFRAMES_LABEL).isChecked?.()).toBe(false);
  });

  it('runs the matching callback from every row', () => {
    const actions = viewportTypeMenuTestActionsCreate();
    const state = viewportTypeMenuTestStateCreate(ViewportKind.PERSPECTIVE, true);
    const entries = buildViewportViewMenuEntries(() => state, actions);
    [...VIEWPORT_VIEW_CHOICES_2D, ...VIEWPORT_VIEW_CHOICES_3D].forEach((choice) => {
      viewportTypeMenuTestRowRead(entries, choice.label).onClick();
      expect(actions.onViewChoiceSelect).toHaveBeenLastCalledWith(choice);
    });
    viewportTypeMenuTestRowRead(entries, VIEWPORT_VIEW_MENU_WIREFRAMES_LABEL).onClick();
    viewportTypeMenuTestRowRead(entries, VIEWPORT_VIEW_MENU_PROJECTED_GRID_LABEL).onClick();
    viewportTypeMenuTestRowRead(entries, VIEWPORT_VIEW_MENU_FIT_LABEL).onClick();
    viewportTypeMenuTestRowRead(entries, VIEWPORT_VIEW_MENU_MAXIMIZE_LABEL).onClick();
    viewportTypeMenuTestRowRead(entries, VIEWPORT_VIEW_MENU_PLAY_FROM_HERE_LABEL).onClick();
    expect(actions.onContentWireframesToggle).toHaveBeenCalledOnce();
    expect(actions.onProjectedGridToggle).toHaveBeenCalledOnce();
    expect(actions.onFit).toHaveBeenCalledOnce();
    expect(actions.onMaximizeToggle).toHaveBeenCalledOnce();
    expect(actions.onPlayFromHere).toHaveBeenCalledOnce();
  });
});
