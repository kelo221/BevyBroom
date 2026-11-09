import { describe, expect, it } from 'vitest';
import {
  VIEWPORT_VIEW_CHOICES_2D,
  VIEWPORT_VIEW_CHOICES_3D,
  viewportViewChoiceIsCurrent,
} from '@/ui/viewport_chrome/viewport_view_choices.js';
import { viewportAxisPairForKind } from '@/ui/viewport_chrome/viewport_axis_caption.js';
import { ShadingMode } from '@/types/shading_mode.js';
import {
  VIEWPORT_KIND_MENU_ORDER,
  ViewportKind,
  getViewportKindDisplayLabel,
  isPerspectiveViewportKind,
} from '@/viewports/core/viewport_kind.js';

describe('VIEWPORT_VIEW_CHOICES_2D', () => {
  it('offers every orthographic kind labelled with its axes and without a shading mode', () => {
    const orthographicKinds = VIEWPORT_KIND_MENU_ORDER.filter((kind) => !isPerspectiveViewportKind(kind));
    expect(VIEWPORT_VIEW_CHOICES_2D.map((choice) => choice.kind)).toEqual(orthographicKinds);
    VIEWPORT_VIEW_CHOICES_2D.forEach((choice) => {
      const axes = viewportAxisPairForKind(choice.kind);
      expect(choice.label).toBe(`2D ${getViewportKindDisplayLabel(choice.kind)} (${axes})`);
      expect(choice.shadingMode).toBeNull();
    });
  });

  it('labels the views Hammer style with the axes the captions show', () => {
    expect(VIEWPORT_VIEW_CHOICES_2D.map((choice) => choice.label)).toEqual([
      '2D Top (x/z)',
      '2D Front (x/y)',
      '2D Side (z/y)',
    ]);
  });
});

describe('VIEWPORT_VIEW_CHOICES_3D', () => {
  it('offers the perspective kind once per implemented shading mode', () => {
    expect(VIEWPORT_VIEW_CHOICES_3D.every((choice) => choice.kind === ViewportKind.PERSPECTIVE)).toBe(true);
    const offeredModes = VIEWPORT_VIEW_CHOICES_3D.map((choice) => choice.shadingMode);
    expect(new Set(offeredModes)).toEqual(new Set(Object.values(ShadingMode)));
    expect(offeredModes.length).toBe(Object.values(ShadingMode).length);
  });

  it('labels the views Hammer style in menu order', () => {
    expect(VIEWPORT_VIEW_CHOICES_3D.map((choice) => [choice.label, choice.shadingMode])).toEqual([
      ['3D Wireframe', ShadingMode.WIREFRAME],
      ['3D Wireframe Overlay', ShadingMode.WIREFRAME_OVERLAY],
      ['3D Flat', ShadingMode.FLAT],
      ['3D Textured', ShadingMode.SOLID],
    ]);
  });
});

describe('viewportViewChoiceIsCurrent', () => {
  it('matches a 2D choice on its kind whatever the pane shading is', () => {
    const topChoice = VIEWPORT_VIEW_CHOICES_2D.find((choice) => choice.kind === ViewportKind.TOP);
    if (!topChoice) {
      throw new Error('Top choice missing');
    }
    Object.values(ShadingMode).forEach((mode) => {
      expect(viewportViewChoiceIsCurrent(topChoice, ViewportKind.TOP, mode)).toBe(true);
      expect(viewportViewChoiceIsCurrent(topChoice, ViewportKind.FRONT, mode)).toBe(false);
    });
  });

  it('matches exactly one 3D choice for each perspective shading mode', () => {
    Object.values(ShadingMode).forEach((mode) => {
      const current = VIEWPORT_VIEW_CHOICES_3D.filter((choice) =>
        viewportViewChoiceIsCurrent(choice, ViewportKind.PERSPECTIVE, mode),
      );
      expect(current.map((choice) => choice.shadingMode)).toEqual([mode]);
    });
  });

  it('matches no 3D choice on an orthographic pane', () => {
    const current = VIEWPORT_VIEW_CHOICES_3D.filter((choice) =>
      viewportViewChoiceIsCurrent(choice, ViewportKind.SIDE, ShadingMode.SOLID),
    );
    expect(current).toEqual([]);
  });
});
