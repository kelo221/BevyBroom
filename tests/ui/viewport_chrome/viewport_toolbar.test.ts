import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VIEWPORT_CORNER_CLUSTER_CLASS, ViewportToolbar } from '@/ui/viewport_chrome/viewport_toolbar.js';
import {
  VIEWPORT_VIEW_MENU_FIT_LABEL,
  VIEWPORT_VIEW_MENU_MAXIMIZE_LABEL,
  VIEWPORT_VIEW_MENU_PROJECTED_GRID_LABEL,
  VIEWPORT_VIEW_MENU_WIREFRAMES_LABEL,
} from '@/ui/viewport_chrome/viewport_type_menu.js';
import { VIEWPORT_SHADING_CHOICES } from '@/ui/viewport_chrome/viewport_shading_choices.js';
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
 * Returns a shading button that must exist.
 *
 * @param toolbar Viewport chrome under test.
 * @param mode Shading mode of the button.
 * @returns Hover row button.
 */
function viewportToolbarTestShadingButtonRead(toolbar: ViewportToolbar, mode: ShadingMode): HTMLButtonElement {
  const button = toolbar.getShadingButton(mode);
  if (!button) {
    throw new Error(`No shading button for ${mode}`);
  }
  return button;
}

describe('ViewportToolbar', () => {
  let parent: HTMLElement;
  let toolbar: ViewportToolbar;

  beforeEach(() => {
    parent = document.createElement('div');
    document.body.appendChild(parent);
    toolbar = new ViewportToolbar(parent, getViewportKindDisplayLabel(ViewportKind.TOP), ShadingMode.WIREFRAME);
  });

  afterEach(() => {
    toolbar.dispose();
    parent.remove();
    document.body.replaceChildren();
  });

  it('adds only a corner cluster and a hover row to the pane, with no header strip', () => {
    expect(toolbar.getElement().parentElement).toBe(parent);
    expect(toolbar.getElement().classList.contains(VIEWPORT_CORNER_CLUSTER_CLASS)).toBe(true);
    expect(toolbar.getHoverRow().getElement().parentElement).toBe(parent);
    expect(parent.children.length).toBe(2);
    expect(parent.querySelector('.editor-viewport-toolbar')).toBeNull();
  });

  it('places the corner cluster at the top-left over the view', () => {
    const cluster = toolbar.getElement();
    expect(cluster.style.position).toBe('absolute');
    expect(cluster.style.top).toBe('0px');
    expect(cluster.style.left).toBe('0px');
  });

  it('inserts a control right after the corner label', () => {
    const control = document.createElement('button');
    toolbar.insertControlAfterTitle(control);
    expect(toolbar.getTitleElement().nextElementSibling).toBe(control);
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

  it('switches the view kind from the view menu', () => {
    const onKind = vi.fn();
    toolbar.setOnViewportKindChange(onKind);
    toolbar.setViewportKind(ViewportKind.TOP);
    viewportToolbarTestMenuRowClick(toolbar, getViewportKindDisplayLabel(ViewportKind.PERSPECTIVE));
    expect(onKind).toHaveBeenCalledWith(ViewportKind.PERSPECTIVE);
  });

  it('applies the same shading handler from the menu and from the hover buttons', () => {
    const onMode = vi.fn();
    toolbar.setOnShadingMode(onMode);
    viewportToolbarTestMenuRowClick(toolbar, 'Solid');
    expect(onMode).toHaveBeenLastCalledWith(ShadingMode.SOLID);
    expect(toolbar.getActiveShadingMode()).toBe(ShadingMode.SOLID);
    viewportToolbarTestShadingButtonRead(toolbar, ShadingMode.FLAT).click();
    expect(onMode).toHaveBeenLastCalledWith(ShadingMode.FLAT);
    expect(toolbar.getActiveShadingMode()).toBe(ShadingMode.FLAT);
    expect(viewportToolbarTestShadingButtonRead(toolbar, ShadingMode.FLAT).dataset['active']).toBe('true');
    expect(viewportToolbarTestShadingButtonRead(toolbar, ShadingMode.SOLID).dataset['active']).toBe('false');
  });

  it('runs the same maximize handler from the menu and from the hover button', () => {
    const onToggleMaximize = vi.fn();
    toolbar.setOnToggleMaximize(onToggleMaximize);
    viewportToolbarTestMenuRowClick(toolbar, VIEWPORT_VIEW_MENU_MAXIMIZE_LABEL);
    toolbar.getMaximizeButton().click();
    expect(onToggleMaximize).toHaveBeenCalledTimes(2);
  });

  it('shows the maximized state on the hover button', () => {
    toolbar.setMaximized(true);
    expect(toolbar.isMaximized()).toBe(true);
    expect(toolbar.getMaximizeButton().dataset['active']).toBe('true');
    expect(toolbar.getMaximizeButton().title).toBe('Restore viewport layout');
    toolbar.setMaximized(false);
    expect(toolbar.getMaximizeButton().dataset['active']).toBe('false');
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

  it('offers one hover button per shading choice and highlights the initial mode', () => {
    VIEWPORT_SHADING_CHOICES.forEach((choice) => {
      const button = viewportToolbarTestShadingButtonRead(toolbar, choice.mode);
      expect(button.dataset['active']).toBe(choice.mode === ShadingMode.WIREFRAME ? 'true' : 'false');
    });
  });

  it('removes the corner cluster and the hover row on dispose', () => {
    toolbar.dispose();
    expect(parent.children.length).toBe(0);
  });
});
