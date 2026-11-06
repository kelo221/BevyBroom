import { afterEach, describe, expect, it, vi } from 'vitest';
import { Theme } from '@/theme.js';
import { TOOL_RAIL_CATALOG_ORDER } from '@/tools/chrome/rail/tool_rail_catalog.js';
import { ViewportToolRail } from '@/tools/chrome/rail/viewport_tool_rail.js';

/** Rail built by the running test. */
let viewportToolRailTestRail: ViewportToolRail | null = null;

/**
 * Builds a rail under a fresh pane element.
 *
 * @param onSelectTool Tool selection callback.
 * @returns The rail.
 */
function viewportToolRailTestCreate(onSelectTool = vi.fn()): ViewportToolRail {
  const pane = document.createElement('div');
  document.body.appendChild(pane);
  viewportToolRailTestRail = new ViewportToolRail(pane, { onSelectTool });
  return viewportToolRailTestRail;
}

afterEach(() => {
  viewportToolRailTestRail?.dispose();
  viewportToolRailTestRail = null;
  document.body.replaceChildren();
});

describe('ViewportToolRail', () => {
  it('shows one palette sized button per catalog tool with its full colour icon', () => {
    const buttons = [...viewportToolRailTestCreate().getElement().querySelectorAll('button')];
    expect(buttons).toHaveLength(TOOL_RAIL_CATALOG_ORDER.length);
    buttons.forEach((button, index) => {
      const icon = button.querySelector('svg');
      expect(button.style.width).toBe(`${Theme.toolPaletteButtonPx}px`);
      expect(button.style.height).toBe(`${Theme.toolPaletteButtonPx}px`);
      expect(icon?.getAttribute('width')).toBe(String(Theme.toolPaletteIconPx));
      expect(icon?.getAttribute('height')).toBe(String(Theme.toolPaletteIconPx));
      expect(icon?.getAttribute('data-icon-hammer')).toBe(TOOL_RAIL_CATALOG_ORDER[index]?.iconName);
    });
  });

  it('fits its buttons without a fixed width narrower than the palette icons', () => {
    const rail = viewportToolRailTestCreate();
    expect(rail.getElement().style.width).toBe('auto');
  });

  it('selects the tool of a clicked button', () => {
    const onSelectTool = vi.fn();
    const rail = viewportToolRailTestCreate(onSelectTool);
    const lastEntry = TOOL_RAIL_CATALOG_ORDER[TOOL_RAIL_CATALOG_ORDER.length - 1];
    const buttons = rail.getElement().querySelectorAll('button');
    buttons[buttons.length - 1]?.click();
    expect(onSelectTool).toHaveBeenCalledWith(lastEntry?.id);
  });
});
