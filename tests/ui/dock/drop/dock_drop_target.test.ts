import { describe, expect, it } from 'vitest';
import { DOCK_DROP_EDGE_BAND_PX, dockDropTargetResolve } from '@/ui/dock/drop/dock_drop_target.js';

/** Dock area the drop tests resolve against. */
const AREA = { left: 50, top: 40, width: 900, height: 600 };

/**
 * Resolves the target of a release point with no shown docks unless given.
 *
 * @param clientX Release X.
 * @param clientY Release Y.
 * @param shownZoneRects Shown docks.
 * @returns Dock target.
 */
function resolveAt(clientX: number, clientY: number, shownZoneRects = {}) {
  return dockDropTargetResolve({ clientX, clientY, areaRect: AREA, shownZoneRects });
}

/** A released window docks to the edge band it is over, or onto a shown dock. */
describe('dockDropTargetResolve', () => {
  const insideBand = DOCK_DROP_EDGE_BAND_PX / 2;

  it('docks to the edge whose band holds the pointer with a preview along that edge', () => {
    const left = resolveAt(AREA.left + insideBand, AREA.top + 300);
    expect(left?.side).toBe('left');
    expect(left?.previewRect.left).toBe(AREA.left);
    expect(left?.previewRect.height).toBe(AREA.height);
    const right = resolveAt(AREA.left + AREA.width - insideBand, AREA.top + 300);
    expect(right?.side).toBe('right');
    expect((right?.previewRect.left ?? 0) + (right?.previewRect.width ?? 0)).toBeCloseTo(AREA.left + AREA.width);
    const bottom = resolveAt(AREA.left + 450, AREA.top + AREA.height - insideBand);
    expect(bottom?.side).toBe('bottom');
    expect(bottom?.previewRect.width).toBe(AREA.width);
  });

  it('keeps floating in the middle of the area and outside it', () => {
    expect(resolveAt(AREA.left + AREA.width / 2, AREA.top + AREA.height / 2)).toBeNull();
    expect(resolveAt(AREA.left - 10, AREA.top + 300)).toBeNull();
  });

  it('docks onto a shown dock under the pointer and previews that dock', () => {
    const rightDock = { left: AREA.left + 600, top: AREA.top, width: 300, height: AREA.height };
    const target = resolveAt(AREA.left + 700, AREA.top + 300, { right: rightDock });
    expect(target).toEqual({ side: 'right', previewRect: rightDock });
  });
});
