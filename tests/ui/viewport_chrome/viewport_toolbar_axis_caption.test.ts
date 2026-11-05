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

  it('shows the caption for the initial title in a dedicated span', () => {
    const caption = toolbar.getElement().querySelector('.viewport-toolbar-hammer-caption');
    expect(caption).toBe(toolbar.getAxisCaptionElement());
    expect(caption?.textContent).toBe(viewportAxisCaptionForKind(ViewportKind.TOP));
  });

  it('keeps the caption outside the title button so the title text stays the kind label', () => {
    const titleLabel = toolbar.getTitleElement().querySelector('span');
    expect(titleLabel?.textContent).toBe(getViewportKindDisplayLabel(ViewportKind.TOP));
    expect(toolbar.getTitleElement().contains(toolbar.getAxisCaptionElement())).toBe(false);
  });

  it('updates the caption whenever the viewport kind changes', () => {
    for (const kind of VIEWPORT_KIND_MENU_ORDER) {
      toolbar.setViewportKind(kind);
      expect(toolbar.getAxisCaptionElement().textContent).toBe(viewportAxisCaptionForKind(kind));
    }
  });
});
