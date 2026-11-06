import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ViewportToolbar } from '@/ui/viewport_chrome/viewport_toolbar.js';
import { viewportAxisCaptionForKind } from '@/ui/viewport_chrome/viewport_axis_caption.js';
import { ShadingMode } from '@/types/shading_mode.js';
import { getViewportKindDisplayLabel, VIEWPORT_KIND_MENU_ORDER, ViewportKind } from '@/viewports/core/viewport_kind.js';

describe('ViewportToolbar axis caption', () => {
  let parent: HTMLElement;
  let toolbar: ViewportToolbar;

  beforeEach(() => {
    parent = document.createElement('div');
    document.body.appendChild(parent);
    toolbar = new ViewportToolbar(parent, getViewportKindDisplayLabel(ViewportKind.TOP), ShadingMode.SOLID);
  });

  afterEach(() => {
    toolbar.dispose();
    parent.remove();
  });

  it('shows the caption of the initial title in the corner label', () => {
    expect(toolbar.getTitleElement().textContent).toBe(viewportAxisCaptionForKind(ViewportKind.TOP));
  });

  it('names the view kind in the corner label tooltip', () => {
    expect(toolbar.getTitleElement().title).toContain(getViewportKindDisplayLabel(ViewportKind.TOP));
  });

  it('updates the corner label whenever the viewport kind changes', () => {
    for (const kind of VIEWPORT_KIND_MENU_ORDER) {
      toolbar.setViewportKind(kind);
      const caption = viewportAxisCaptionForKind(kind);
      const expected = caption === '' ? getViewportKindDisplayLabel(kind) : caption;
      expect(toolbar.getTitleElement().textContent).toBe(expected);
    }
  });

  it('shows a custom title as is when it names no view kind', () => {
    toolbar.setTitle('Player Camera');
    expect(toolbar.getTitleElement().textContent).toBe('Player Camera');
  });
});
