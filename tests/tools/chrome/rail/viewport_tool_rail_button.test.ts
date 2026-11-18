import { describe, expect, it } from 'vitest';
import { styleViewportToolRailButton } from '@/tools/chrome/rail/viewport_tool_rail_button.js';

/**
 * Proves toggle buttons carry their active state where themed stylesheets can
 * see it.
 */
describe('styleViewportToolRailButton', () => {
  it('marks the active button and clears the mark when it turns idle', () => {
    const button = document.createElement('button');
    styleViewportToolRailButton(button, true);
    expect(button.getAttribute('data-active')).toBe('true');
    styleViewportToolRailButton(button, false);
    expect(button.getAttribute('data-active')).toBe('false');
  });
});
