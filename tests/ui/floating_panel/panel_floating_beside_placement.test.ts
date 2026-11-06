import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PanelFloating } from '@/ui/floating_panel/panel_floating.js';
import { FloatingPanelStack } from '@/ui/floating_panel/panel_floating_stack.js';
import {
  floatingPanelBesidePlacementCompute,
  floatingPanelBesideRectRead,
  FLOATING_PANEL_BESIDE_GAP_PX,
  type FloatingPanelBesidePlacementInput,
} from '@/ui/floating_panel/panel_floating_beside_placement.js';
import type { FloatingPanelRect } from '@/ui/floating_panel/panel_floating_screen_bounds.js';
import {
  panelLeftTopRead,
  stubBoundingRect,
  stubPanelRectFromStyle,
  titleBarDrag,
  windowSizeSet,
} from './panel_floating_test_support.js';

/** Panel size used by every placement case. */
const BESIDE_TEST_PANEL = { width: 140, height: 90 };

/** Screen padding used by every placement case. */
const BESIDE_TEST_PADDING_PX = 8;

/**
 * Builds placement inputs for an element rect on a screen of a given width.
 *
 * @param besideRect Element rect, or null for a missing element.
 * @param screenWidth Screen width in pixels.
 * @param fallbackBounds Bounds the centered fallback uses.
 * @returns Placement input.
 */
function besideTestInput(
  besideRect: FloatingPanelRect | null,
  screenWidth: number,
  fallbackBounds: FloatingPanelRect,
): FloatingPanelBesidePlacementInput {
  return {
    besideRect,
    fallbackBounds,
    panelWidth: BESIDE_TEST_PANEL.width,
    panelHeight: BESIDE_TEST_PANEL.height,
    screenWidth,
    screenPaddingPx: BESIDE_TEST_PADDING_PX,
    gapPx: FLOATING_PANEL_BESIDE_GAP_PX,
  };
}

/**
 * Returns the left/top that centers the test panel in bounds.
 *
 * @param bounds Bounds to center in.
 * @returns Centered left/top.
 */
function besideTestCenterOf(bounds: FloatingPanelRect): { left: number; top: number } {
  return {
    left: Math.round(bounds.left + (bounds.width - BESIDE_TEST_PANEL.width) / 2),
    top: Math.round(bounds.top + (bounds.height - BESIDE_TEST_PANEL.height) / 2),
  };
}

/** Pure placement math of panels opening beside an element. */
describe('floatingPanelBesidePlacementCompute', () => {
  const fallbackBounds = { left: 30, top: 20, width: 900, height: 700 };
  const element = { left: 200, top: 64, width: 320, height: 480 };

  it('places the panel flush right of the element with the gap, top-aligned', () => {
    const screenWidth = element.left + element.width + FLOATING_PANEL_BESIDE_GAP_PX + BESIDE_TEST_PANEL.width * 2;
    const placed = floatingPanelBesidePlacementCompute(besideTestInput(element, screenWidth, fallbackBounds));
    expect(placed.left).toBe(element.left + element.width + FLOATING_PANEL_BESIDE_GAP_PX);
    expect(placed.top).toBe(element.top);
  });

  it('falls back to the left side when the right side runs off screen', () => {
    const screenWidth = element.left + element.width + BESIDE_TEST_PANEL.width / 2;
    const placed = floatingPanelBesidePlacementCompute(besideTestInput(element, screenWidth, fallbackBounds));
    expect(placed.left + BESIDE_TEST_PANEL.width + FLOATING_PANEL_BESIDE_GAP_PX).toBe(element.left);
    expect(placed.top).toBe(element.top);
  });

  it('centers in the fallback bounds when neither side fits or the element is missing', () => {
    const wideElement = { ...element, left: BESIDE_TEST_PANEL.width / 2 };
    const screenWidth = wideElement.left + wideElement.width + BESIDE_TEST_PANEL.width / 2;
    const squeezed = floatingPanelBesidePlacementCompute(besideTestInput(wideElement, screenWidth, fallbackBounds));
    expect(squeezed).toEqual(besideTestCenterOf(fallbackBounds));
    const missing = floatingPanelBesidePlacementCompute(besideTestInput(null, screenWidth, fallbackBounds));
    expect(missing).toEqual(besideTestCenterOf(fallbackBounds));
  });

  it('reads no rect for missing, detached or empty elements', () => {
    expect(floatingPanelBesideRectRead(null)).toBeNull();
    const detached = document.createElement('div');
    stubBoundingRect(detached, element);
    expect(floatingPanelBesideRectRead(detached)).toBeNull();
    document.body.appendChild(detached);
    expect(floatingPanelBesideRectRead(detached)).toEqual(element);
    stubBoundingRect(detached, { ...element, width: 0 });
    expect(floatingPanelBesideRectRead(detached)).toBeNull();
    detached.remove();
  });
});

/** Draggable test panel that opens beside a resolved element. */
class TestBesidePanel extends PanelFloating {
  /** Title bar element the tests drag. */
  readonly titleBar: HTMLElement;

  /**
   * Creates the panel.
   *
   * @param host Host element and centered fallback anchor.
   * @param besideResolver Returns the element the panel opens beside.
   */
  constructor(host: HTMLElement, besideResolver: () => HTMLElement | null) {
    super(host, { corner: 'top-left', besideResolver, paddingPx: BESIDE_TEST_PADDING_PX });
    this.titleBar = document.createElement('div');
    this.bindTitleBarDrag(this.titleBar);
    this.root.appendChild(this.titleBar);
  }
}

/** PanelFloating placement beside an element. */
describe('PanelFloating beside placement', () => {
  const hostRect = { left: 40, top: 30, width: 1000, height: 700 };
  const sheetRect = { left: 120, top: 90, width: 300, height: 420 };
  let host: HTMLElement;
  let sheet: HTMLElement;
  let panel: TestBesidePanel | null;

  beforeEach(() => {
    FloatingPanelStack.resetForTests();
    windowSizeSet(hostRect.left + hostRect.width, hostRect.top + hostRect.height);
    host = document.createElement('div');
    sheet = document.createElement('div');
    document.body.append(host, sheet);
    stubBoundingRect(host, hostRect);
    stubBoundingRect(sheet, sheetRect);
  });

  afterEach(() => {
    panel?.dispose();
    panel = null;
    host.remove();
    sheet.remove();
    FloatingPanelStack.resetForTests();
  });

  /**
   * Creates a beside panel whose rect follows its style.
   *
   * @param besideResolver Returns the element the panel opens beside.
   * @returns Panel.
   */
  function besidePanelCreate(besideResolver: () => HTMLElement | null): TestBesidePanel {
    const created = new TestBesidePanel(host, besideResolver);
    stubPanelRectFromStyle(created.getRootElement(), BESIDE_TEST_PANEL.width, BESIDE_TEST_PANEL.height);
    panel = created;
    return created;
  }

  it('opens flush right of the element, top-aligned', () => {
    const besidePanel = besidePanelCreate(() => sheet);
    besidePanel.show();
    expect(panelLeftTopRead(besidePanel)).toEqual({
      left: sheetRect.left + sheetRect.width + FLOATING_PANEL_BESIDE_GAP_PX,
      top: sheetRect.top,
    });
  });

  it('centers in the anchor when the element is hidden', () => {
    sheet.remove();
    const besidePanel = besidePanelCreate(() => sheet);
    besidePanel.show();
    expect(panelLeftTopRead(besidePanel)).toEqual(besideTestCenterOf(hostRect));
  });

  it('keeps the dragged position on later opens instead of jumping back beside the element', () => {
    const besidePanel = besidePanelCreate(() => sheet);
    besidePanel.show();
    const opened = panelLeftTopRead(besidePanel);
    const dragDelta = { x: 75, y: 55 };
    titleBarDrag(besidePanel.titleBar, opened.left + 4, opened.top + 4, dragDelta.x, dragDelta.y);
    const dragged = panelLeftTopRead(besidePanel);
    expect(dragged).toEqual({ left: opened.left + dragDelta.x, top: opened.top + dragDelta.y });
    besidePanel.hide();
    besidePanel.show();
    expect(panelLeftTopRead(besidePanel)).toEqual(dragged);
  });

  it('uses a resolver set after construction', () => {
    const besidePanel = besidePanelCreate(() => null);
    besidePanel.setBesideResolver(() => sheet);
    besidePanel.show();
    expect(panelLeftTopRead(besidePanel).top).toBe(sheetRect.top);
  });
});
