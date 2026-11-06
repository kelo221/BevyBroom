import { describe, it, expect } from 'vitest';
import { Theme } from '@/theme.js';
import { themeColorChannelSum } from './theme/theme_color_parse_support.js';
import { ViewportType } from '@/types.js';

describe('Theme', () => {
  it('should use light chrome around black 2D views and a grey 3D view', () => {
    expect(themeColorChannelSum(Theme.background)).toBeGreaterThan(themeColorChannelSum(Theme.viewportBackground));
    expect(themeColorChannelSum(Theme.viewportBackground)).toBeGreaterThan(
      themeColorChannelSum(Theme.viewport2dBackground),
    );
  });
});

describe('Viewport separators', () => {
  it('should have a separator gap greater than 1px for visibility', () => {
    expect(Theme.separatorGapPx).toBeGreaterThan(1);
  });

  it('should use a separator color that stands out from both view backgrounds', () => {
    expect(Theme.separatorColor).not.toBe(Theme.viewportBackground);
    expect(Theme.separatorColor).not.toBe(Theme.viewport2dBackground);
    expect(themeColorChannelSum(Theme.separatorColor)).toBeGreaterThan(
      themeColorChannelSum(Theme.viewport2dBackground),
    );
  });
});

describe('ViewportType', () => {
  it('should have all four viewport types defined', () => {
    expect(ViewportType.TOP).toBe('top');
    expect(ViewportType.FRONT).toBe('front');
    expect(ViewportType.SIDE).toBe('side');
    expect(ViewportType.PERSPECTIVE).toBe('perspective');
  });

  it('should have exactly four viewport types', () => {
    const values = Object.values(ViewportType).filter((v) => typeof v === 'string');
    expect(values.length).toBe(4);
  });
});
