import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VIEWPORT_CORNER_CLUSTER_CLASS, ViewportToolbar } from '@/ui/viewport_chrome/viewport_toolbar.js';
import {
  VIEWPORT_VIEW_MENU_FIT_LABEL,
  VIEWPORT_VIEW_MENU_MAXIMIZE_LABEL,
  VIEWPORT_VIEW_MENU_PLAY_FROM_HERE_LABEL,
  VIEWPORT_VIEW_MENU_PROJECTED_GRID_LABEL,
  VIEWPORT_VIEW_MENU_WIREFRAMES_LABEL,
} from '@/ui/viewport_chrome/viewport_type_menu.js';
import {
  VIEWPORT_VIEW_CHOICES_2D,
  VIEWPORT_VIEW_CHOICES_3D,
  type ViewportViewChoice,
} from '@/ui/viewport_chrome/viewport_view_choices.js';
import { ShadingMode } from '@/types/shading_mode.js';
import { ViewportKind, getViewportKindDisplayLabel } from '@/viewports/core/viewport_kind.js';

/**
 * Opens the view menu from the corner label and returns its panel element.
 *
 * @param toolbar Viewport chrome under test.
 * @returns Open menu panel element.
 */
function viewportToolbarTestMenuOpen(toolbar: ViewportToolbar): HTMLElement {
  toolbar.getTitleElement().click();
  const panel = toolbar.getViewMenuPanel();
  if (!panel || !panel.isOpen()) {
    throw new Error('View menu did not open');
  }
  return panel.getElement();
}

/**
 * Opens the view menu and returns the text of every row.
 *
 * @param toolbar Viewport chrome under test.
 * @returns Row texts in menu order.
 */
function viewportToolbarTestMenuRowTextsRead(toolbar: ViewportToolbar): string[] {
  const panelElement = viewportToolbarTestMenuOpen(toolbar);
  const texts = Array.from(panelElement.querySelectorAll('button')).map((button) => button.textContent ?? '');
  toolbar.getTitleElement().click();
  return texts;
}

/**
 * Clicks the view menu row whose text contains a label.
 *
 * @param toolbar Viewport chrome under test.
 * @param label Row label.
 */
function viewportToolbarTestMenuRowClick(toolbar: ViewportToolbar, label: string): void {
  const panelElement = viewportToolbarTestMenuOpen(toolbar);
  const row = Array.from(panelElement.querySelectorAll('button')).find((button) =>
    (button.textContent ?? '').includes(label),
  );
  if (!row) {
    throw new Error(`View menu row ${label} not found`);
  }
  row.click();
}

/**
 * Returns the view choice of a kind and shading mode that must exist.
 *
 * @param choices View choices to search.
 * @param kind View kind of the choice.
 * @param shadingMode Shading mode of the choice, or null for 2D choices.
 * @returns Matching view choice.
 */
function viewportToolbarTestChoiceRead(
  choices: readonly ViewportViewChoice[],
  kind: ViewportKind,
  shadingMode: ShadingMode | null,
): ViewportViewChoice {
  const choice = choices.find((candidate) => candidate.kind === kind && candidate.shadingMode === shadingMode);
  if (!choice) {
    throw new Error(`No view choice for ${kind} ${String(shadingMode)}`);
  }
  return choice;
}

describe('ViewportToolbar', () => {
  let parent: HTMLElement;
  let toolbar: ViewportToolbar;

  beforeEach(() => {
    parent = document.createElement('div');
    document.body.appendChild(parent);
    toolbar = new ViewportToolbar(parent, getViewportKindDisplayLabel(ViewportKind.TOP), ShadingMode.WIREFRAME);
    toolbar.setViewportKind(ViewportKind.TOP);
  });

  afterEach(() => {
    toolbar.dispose();
    parent.remove();
    document.body.replaceChildren();
  });

  it('adds only the corner cluster to the pane, with no hover icon row or header strip', () => {
    expect(toolbar.getElement().parentElement).toBe(parent);
    expect(toolbar.getElement().classList.contains(VIEWPORT_CORNER_CLUSTER_CLASS)).toBe(true);
    expect(parent.children.length).toBe(1);
    expect(parent.querySelector('.editor-viewport-toolbar')).toBeNull();
    expect(parent.querySelector('.editor-viewport-hover-row')).toBeNull();
    expect(parent.querySelectorAll('svg').length).toBe(0);
  });

  it('places the corner cluster at the top-left over the view', () => {
    const cluster = toolbar.getElement();
    expect(cluster.style.position).toBe('absolute');
    expect(cluster.style.top).toBe('0px');
    expect(cluster.style.left).toBe('0px');
  });

  it('opens the view menu from the corner label and closes it on an outside press', () => {
    viewportToolbarTestMenuOpen(toolbar);
    expect(toolbar.getTitleElement().getAttribute('aria-expanded')).toBe('true');
    const outside = document.createElement('div');
    document.body.appendChild(outside);
    outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 2 }));
    expect(toolbar.getViewMenuPanel()?.isOpen()).toBe(false);
    expect(toolbar.getTitleElement().getAttribute('aria-expanded')).toBe('false');
  });

  it('switches to another 2D view without a shading mode', () => {
    const onKind = vi.fn();
    toolbar.setOnViewportKindChange(onKind);
    const sideChoice = viewportToolbarTestChoiceRead(VIEWPORT_VIEW_CHOICES_2D, ViewportKind.SIDE, null);
    viewportToolbarTestMenuRowClick(toolbar, sideChoice.label);
    expect(onKind).toHaveBeenCalledWith(ViewportKind.SIDE, null);
  });

  it('ignores the 2D row of the current view', () => {
    const onKind = vi.fn();
    const onMode = vi.fn();
    toolbar.setOnViewportKindChange(onKind);
    toolbar.setOnShadingMode(onMode);
    const topChoice = viewportToolbarTestChoiceRead(VIEWPORT_VIEW_CHOICES_2D, ViewportKind.TOP, null);
    viewportToolbarTestMenuRowClick(toolbar, topChoice.label);
    expect(onKind).not.toHaveBeenCalled();
    expect(onMode).not.toHaveBeenCalled();
  });

  it('switches a 2D pane to perspective together with the chosen 3D shading', () => {
    const onKind = vi.fn();
    toolbar.setOnViewportKindChange(onKind);
    const flatChoice = viewportToolbarTestChoiceRead(
      VIEWPORT_VIEW_CHOICES_3D,
      ViewportKind.PERSPECTIVE,
      ShadingMode.FLAT,
    );
    viewportToolbarTestMenuRowClick(toolbar, flatChoice.label);
    expect(onKind).toHaveBeenCalledWith(ViewportKind.PERSPECTIVE, ShadingMode.FLAT);
  });

  it('only changes the shading when a 3D row is chosen on a perspective pane', () => {
    const onKind = vi.fn();
    const onMode = vi.fn();
    toolbar.setViewportKind(ViewportKind.PERSPECTIVE);
    toolbar.setOnViewportKindChange(onKind);
    toolbar.setOnShadingMode(onMode);
    const overlayChoice = viewportToolbarTestChoiceRead(
      VIEWPORT_VIEW_CHOICES_3D,
      ViewportKind.PERSPECTIVE,
      ShadingMode.WIREFRAME_OVERLAY,
    );
    viewportToolbarTestMenuRowClick(toolbar, overlayChoice.label);
    expect(onKind).not.toHaveBeenCalled();
    expect(onMode).toHaveBeenCalledWith(ShadingMode.WIREFRAME_OVERLAY);
    expect(toolbar.getActiveShadingMode()).toBe(ShadingMode.WIREFRAME_OVERLAY);
  });

  it('runs the maximize handler from the menu and records the maximized state', () => {
    const onToggleMaximize = vi.fn();
    toolbar.setOnToggleMaximize(onToggleMaximize);
    viewportToolbarTestMenuRowClick(toolbar, VIEWPORT_VIEW_MENU_MAXIMIZE_LABEL);
    expect(onToggleMaximize).toHaveBeenCalledOnce();
    toolbar.setMaximized(true);
    expect(toolbar.isMaximized()).toBe(true);
    toolbar.setMaximized(false);
    expect(toolbar.isMaximized()).toBe(false);
  });

  it('runs the fit handler from Fit to Selection', () => {
    const onFit = vi.fn();
    toolbar.setOnFit(onFit);
    viewportToolbarTestMenuRowClick(toolbar, VIEWPORT_VIEW_MENU_FIT_LABEL);
    expect(onFit).toHaveBeenCalledOnce();
  });

  it('toggles content wireframes and the projected grid from the menu', () => {
    const onWireframes = vi.fn();
    const onGrid = vi.fn();
    toolbar.setOnContentWireframesToggle(onWireframes);
    toolbar.setOnProjectedGridToggle(onGrid);
    const wireframesBefore = toolbar.isContentWireframesActive();
    const gridBefore = toolbar.isProjectedGridActive();
    viewportToolbarTestMenuRowClick(toolbar, VIEWPORT_VIEW_MENU_WIREFRAMES_LABEL);
    viewportToolbarTestMenuRowClick(toolbar, VIEWPORT_VIEW_MENU_PROJECTED_GRID_LABEL);
    expect(onWireframes).toHaveBeenCalledWith(!wireframesBefore);
    expect(onGrid).toHaveBeenCalledWith(!gridBefore);
    expect(toolbar.isContentWireframesActive()).toBe(!wireframesBefore);
    expect(toolbar.isProjectedGridActive()).toBe(!gridBefore);
  });

  it('offers Play from here only on a perspective pane with a play handler', () => {
    const onPlay = vi.fn();
    toolbar.setOnPlayFromHere(onPlay);
    expect(toolbar.isPlayFromHereAvailable()).toBe(false);
    expect(viewportToolbarTestMenuRowTextsRead(toolbar).join('|')).not.toContain(
      VIEWPORT_VIEW_MENU_PLAY_FROM_HERE_LABEL,
    );
    toolbar.setViewportKind(ViewportKind.PERSPECTIVE);
    expect(toolbar.isPlayFromHereAvailable()).toBe(true);
    viewportToolbarTestMenuRowClick(toolbar, VIEWPORT_VIEW_MENU_PLAY_FROM_HERE_LABEL);
    expect(onPlay).toHaveBeenCalledOnce();
    toolbar.setOnPlayFromHere(null);
    expect(toolbar.isPlayFromHereAvailable()).toBe(false);
    expect(viewportToolbarTestMenuRowTextsRead(toolbar).join('|')).not.toContain(
      VIEWPORT_VIEW_MENU_PLAY_FROM_HERE_LABEL,
    );
  });

  it('removes the corner cluster on dispose', () => {
    toolbar.dispose();
    expect(parent.children.length).toBe(0);
  });
});
