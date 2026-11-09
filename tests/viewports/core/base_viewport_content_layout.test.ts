import { describe, expect, it } from 'vitest';
import {
  applyViewportContainerChromeStyles,
  applyViewportContentDrawableStyles,
  isLayoutManagedAreaContainer,
} from '@/viewports/core/viewport_base.js';

/**
 * Content fills the whole pane: the corner label floats over it, and the
 * floating tool panel reserves no layout space.
 */
describe('applyViewportContentDrawableStyles', () => {
  it('should fill the pane from its top edge', () => {
    const content = document.createElement('div');
    applyViewportContentDrawableStyles(content);
    expect(content.style.top).toBe('0px');
    expect(content.style.bottom).toBe('0px');
    expect(content.style.left).toBe('0px');
    expect(content.style.right).toBe('0px');
    expect(content.style.position).toBe('absolute');
  });
});

describe('applyViewportContainerChromeStyles', () => {
  it('should preserve absolute tiling geometry on area-managed containers', () => {
    const container = document.createElement('div');
    container.dataset['areaId'] = 'pane_area_1';
    container.style.position = 'absolute';
    container.style.left = 'calc(25% + 2px)';
    container.style.top = 'calc(0% + 2px)';
    container.style.width = 'calc(25% - 4px)';
    container.style.height = 'calc(50% - 4px)';
    applyViewportContainerChromeStyles(container);
    expect(isLayoutManagedAreaContainer(container)).toBe(true);
    expect(container.style.position).toBe('absolute');
    expect(container.style.left).toBe('calc(25% + 2px)');
    expect(container.style.width).toBe('calc(25% - 4px)');
    expect(container.style.height).toBe('calc(50% - 4px)');
  });

  it('should fill the parent for non-tiled hosts such as detached popups', () => {
    const container = document.createElement('div');
    applyViewportContainerChromeStyles(container);
    expect(isLayoutManagedAreaContainer(container)).toBe(false);
    expect(container.style.position).toBe('relative');
    expect(container.style.width).toBe('100%');
    expect(container.style.height).toBe('100%');
  });
});
