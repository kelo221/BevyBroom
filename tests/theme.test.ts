import { describe, it, expect } from 'vitest';
import { Theme } from '@/theme.js';
import { themeColorChannelSum } from './theme/theme_color_parse_support.js';

describe('Theme', () => {
  it('should freeze theme tokens against mutation', () => {
    expect(Object.isFrozen(Theme)).toBe(true);
    expect(() => {
      (Theme as { selectionColor: number }).selectionColor = 0x000000;
    }).toThrow();
  });

  it('should expose a red selection color that dominates its green and blue channels', () => {
    const red = (Theme.selectionColor >> 16) & 255;
    const green = (Theme.selectionColor >> 8) & 255;
    const blue = Theme.selectionColor & 255;
    expect(red).toBeGreaterThan(green * 2);
    expect(red).toBeGreaterThan(blue * 2);
  });

  it('should draw the 2D views darker than the 3D view', () => {
    expect(themeColorChannelSum(Theme.viewport2dBackground)).toBeLessThan(
      themeColorChannelSum(Theme.viewportBackground),
    );
  });

  it('should expose distinct clip point and keep/discard preview colors', () => {
    expect(Theme.clipPoint1Color).not.toBe(Theme.clipPoint2Color);
    expect(Theme.clipPoint2Color).not.toBe(Theme.clipPoint3Color);
    expect(Theme.clipKeepColor).not.toBe(Theme.clipDiscardColor);
    expect(Theme.clipMarkerColor).not.toBe(Theme.selectionColor);
  });
});
