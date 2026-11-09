import { describe, expect, it } from 'vitest';
import {
  viewportAxisCaptionForKind,
  viewportAxisCaptionForTitle,
  viewportAxisPairForKind,
} from '@/ui/viewport_chrome/viewport_axis_caption.js';
import { getViewportKindDisplayLabel, VIEWPORT_KIND_MENU_ORDER, ViewportKind } from '@/viewports/core/viewport_kind.js';

describe('viewportAxisCaptionForKind', () => {
  it('names the screen axes of each view in Y-up coordinates', () => {
    expect(viewportAxisCaptionForKind(ViewportKind.PERSPECTIVE)).toBe('camera');
    expect(viewportAxisCaptionForKind(ViewportKind.TOP)).toBe('top (x/z)');
    expect(viewportAxisCaptionForKind(ViewportKind.FRONT)).toBe('front (x/y)');
    expect(viewportAxisCaptionForKind(ViewportKind.SIDE)).toBe('side (z/y)');
  });

  it('keeps the kind display labels unchanged', () => {
    expect(getViewportKindDisplayLabel(ViewportKind.PERSPECTIVE)).toBe('Perspective');
    expect(getViewportKindDisplayLabel(ViewportKind.TOP)).toBe('Top');
    expect(getViewportKindDisplayLabel(ViewportKind.FRONT)).toBe('Front');
    expect(getViewportKindDisplayLabel(ViewportKind.SIDE)).toBe('Side');
  });
});

describe('viewportAxisPairForKind', () => {
  it('returns the axes each orthographic caption shows and none for the perspective view', () => {
    expect(viewportAxisPairForKind(ViewportKind.PERSPECTIVE)).toBe('');
    for (const kind of VIEWPORT_KIND_MENU_ORDER.filter((candidate) => candidate !== ViewportKind.PERSPECTIVE)) {
      const axisPair = viewportAxisPairForKind(kind);
      expect(axisPair).toMatch(/^[xyz]\/[xyz]$/);
      expect(viewportAxisCaptionForKind(kind)).toContain(`(${axisPair})`);
    }
  });
});

describe('viewportAxisCaptionForTitle', () => {
  it('maps every kind display label to that kind caption', () => {
    for (const kind of VIEWPORT_KIND_MENU_ORDER) {
      expect(viewportAxisCaptionForTitle(getViewportKindDisplayLabel(kind))).toBe(viewportAxisCaptionForKind(kind));
    }
  });

  it('returns an empty caption for titles that are not a kind label', () => {
    expect(viewportAxisCaptionForTitle('Detached Pane')).toBe('');
  });
});
