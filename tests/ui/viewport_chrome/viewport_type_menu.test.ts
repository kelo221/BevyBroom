import { describe, expect, it, vi } from 'vitest';
import {
  VIEWPORT_VIEW_MENU_FIT_LABEL,
  VIEWPORT_VIEW_MENU_MAXIMIZE_LABEL,
  VIEWPORT_VIEW_MENU_PROJECTED_GRID_LABEL,
  VIEWPORT_VIEW_MENU_WIREFRAMES_LABEL,
  buildViewportViewMenuEntries,
  type ViewportViewMenuActions,
  type ViewportViewMenuState,
} from '@/ui/viewport_chrome/viewport_type_menu.js';
import { VIEWPORT_SHADING_CHOICES } from '@/ui/viewport_chrome/viewport_shading_choices.js';
import { isMenuAction, type ToolbarMenuAction, type ToolbarMenuEntry } from '@/ui/menu/menu_types.js';
import { ShadingMode } from '@/types/shading_mode.js';
import { VIEWPORT_KIND_MENU_ORDER, ViewportKind, getViewportKindDisplayLabel } from '@/viewports/core/viewport_kind.js';

/**
 * Creates view menu actions whose every callback is a spy.
 *
 * @returns Spy actions.
 */
function viewportTypeMenuTestActionsCreate(): ViewportViewMenuActions {
  return {
    onKindSelect: vi.fn(),
    onShadingSelect: vi.fn(),
    onContentWireframesToggle: vi.fn(),
    onProjectedGridToggle: vi.fn(),
    onFit: vi.fn(),
    onMaximizeToggle: vi.fn(),
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
 * Builds a mutable viewport state for the menu checks.
 *
 * @returns Viewport state with the perspective view and solid shading.
 */
function viewportTypeMenuTestStateCreate(): {
  -readonly [Key in keyof ViewportViewMenuState]: ViewportViewMenuState[Key];
} {
  return {
    kind: ViewportKind.PERSPECTIVE,
    shadingMode: ShadingMode.SOLID,
    contentWireframesActive: true,
    projectedGridActive: false,
    maximized: false,
  };
}

describe('buildViewportViewMenuEntries', () => {
  it('lists every view kind, every shading choice, both render toggles, fit and maximize', () => {
    const entries = buildViewportViewMenuEntries(viewportTypeMenuTestStateCreate, viewportTypeMenuTestActionsCreate());
    const labels = entries.flatMap((entry) => (isMenuAction(entry) ? [entry.label] : []));
    expect(labels).toEqual([
      ...VIEWPORT_KIND_MENU_ORDER.map((kind) => getViewportKindDisplayLabel(kind)),
      ...VIEWPORT_SHADING_CHOICES.map((choice) => choice.label),
      VIEWPORT_VIEW_MENU_WIREFRAMES_LABEL,
      VIEWPORT_VIEW_MENU_PROJECTED_GRID_LABEL,
      VIEWPORT_VIEW_MENU_FIT_LABEL,
      VIEWPORT_VIEW_MENU_MAXIMIZE_LABEL,
    ]);
  });

  it('checks the rows from the live viewport state', () => {
    const state = viewportTypeMenuTestStateCreate();
    const entries = buildViewportViewMenuEntries(() => state, viewportTypeMenuTestActionsCreate());
    VIEWPORT_SHADING_CHOICES.forEach((choice) => {
      state.shadingMode = choice.mode;
      expect(viewportTypeMenuTestRowRead(entries, choice.label).isChecked?.()).toBe(true);
    });
    state.maximized = true;
    state.projectedGridActive = true;
    expect(viewportTypeMenuTestRowRead(entries, VIEWPORT_VIEW_MENU_MAXIMIZE_LABEL).isChecked?.()).toBe(true);
    expect(viewportTypeMenuTestRowRead(entries, VIEWPORT_VIEW_MENU_PROJECTED_GRID_LABEL).isChecked?.()).toBe(true);
    const kindLabel = getViewportKindDisplayLabel(state.kind);
    expect(viewportTypeMenuTestRowRead(entries, kindLabel).isChecked?.()).toBe(true);
  });

  it('runs the matching callback from every row', () => {
    const actions = viewportTypeMenuTestActionsCreate();
    const entries = buildViewportViewMenuEntries(viewportTypeMenuTestStateCreate, actions);
    const lastKind = VIEWPORT_KIND_MENU_ORDER[VIEWPORT_KIND_MENU_ORDER.length - 1] ?? ViewportKind.TOP;
    const lastShading = VIEWPORT_SHADING_CHOICES[VIEWPORT_SHADING_CHOICES.length - 1];
    viewportTypeMenuTestRowRead(entries, getViewportKindDisplayLabel(lastKind)).onClick();
    viewportTypeMenuTestRowRead(entries, lastShading?.label ?? '').onClick();
    viewportTypeMenuTestRowRead(entries, VIEWPORT_VIEW_MENU_WIREFRAMES_LABEL).onClick();
    viewportTypeMenuTestRowRead(entries, VIEWPORT_VIEW_MENU_PROJECTED_GRID_LABEL).onClick();
    viewportTypeMenuTestRowRead(entries, VIEWPORT_VIEW_MENU_FIT_LABEL).onClick();
    viewportTypeMenuTestRowRead(entries, VIEWPORT_VIEW_MENU_MAXIMIZE_LABEL).onClick();
    expect(actions.onKindSelect).toHaveBeenCalledWith(lastKind);
    expect(actions.onShadingSelect).toHaveBeenCalledWith(lastShading?.mode);
    expect(actions.onContentWireframesToggle).toHaveBeenCalledOnce();
    expect(actions.onProjectedGridToggle).toHaveBeenCalledOnce();
    expect(actions.onFit).toHaveBeenCalledOnce();
    expect(actions.onMaximizeToggle).toHaveBeenCalledOnce();
  });
});
