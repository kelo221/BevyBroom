import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PanelFloating } from '@/ui/floating_panel/panel_floating.js';
import { FloatingPanelStack } from '@/ui/floating_panel/panel_floating_stack.js';
import {
  panelLeftTopRead,
  stubBoundingRect,
  stubPanelRectFromStyle,
  titleBarDrag,
  windowSizeSet,
} from './panel_floating_test_support.js';

/** Minimal concrete FloatingPanel for unit tests. */
class TestCenteredFloatingPanel extends PanelFloating {
  /**
   * Creates a centered test panel without a corner.
   *
   * @param host Host element.
   */
  constructor(host: HTMLElement) {
    super(host, { centered: true, paddingPx: 8 });
    this.root.style.width = '120px';
    this.root.style.height = '80px';
  }
}

class TestFloatingPanel extends PanelFloating {
  /**
   * Creates a test panel with a simple title bar and body.
   *
   * @param host Host element.
   * @param anchor Optional default anchor.
   */
  constructor(host: HTMLElement, anchor: HTMLElement | null = null) {
    super(host, { corner: 'bottom-left', paddingPx: 8 }, anchor);
    const title = document.createElement('div');
    title.dataset['testTitle'] = '1';
    title.style.height = '24px';
    this.bindTitleBarDrag(title);
    this.root.appendChild(title);
    this.root.style.width = '120px';
    this.root.style.height = '80px';
  }
}

describe('FloatingPanel', () => {
  let host: HTMLElement;
  let panel: TestFloatingPanel | null;

  beforeEach(() => {
    FloatingPanelStack.resetForTests();
  });

  afterEach(() => {
    panel?.dispose();
    panel = null;
    host?.remove();
    FloatingPanelStack.resetForTests();
  });

  it('starts hidden and toggles open and closed', () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    panel = new TestFloatingPanel(host);
    expect(panel.isOpen()).toBe(false);
    expect(panel.isMountedInHost()).toBe(false);
    expect(host.contains(panel.getRootElement())).toBe(false);
    panel.show();
    expect(panel.isOpen()).toBe(true);
    expect(panel.isMountedInHost()).toBe(true);
    expect(host.contains(panel.getRootElement())).toBe(true);
    expect(panel.getRootElement().style.display).toBe('flex');
    panel.hide();
    expect(panel.isOpen()).toBe(false);
    expect(panel.isMountedInHost()).toBe(false);
    expect(host.contains(panel.getRootElement())).toBe(false);
    panel.toggle();
    expect(panel.isOpen()).toBe(true);
    panel.toggle();
    expect(panel.isOpen()).toBe(false);
    expect(host.contains(panel.getRootElement())).toBe(false);
  });

  it('opens a centered panel when the corner option is omitted', () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    const centered = new TestCenteredFloatingPanel(host);
    centered.show();
    expect(centered.isOpen()).toBe(true);
    expect(host.contains(centered.getRootElement())).toBe(true);
    centered.dispose();
  });

  it('places bottom-left of the anchor with padding on first show', () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    const anchor = document.createElement('div');
    document.body.appendChild(anchor);
    stubBoundingRect(anchor, { left: 100, top: 50, width: 200, height: 300 });
    panel = new TestFloatingPanel(host, anchor);
    stubPanelRectFromStyle(panel.getRootElement(), 120, 80);
    panel.show();
    const root = panel.getRootElement();
    expect(root.style.left).toBe('108px');
    expect(root.style.top).toBe('262px');
    anchor.remove();
  });

  it('rescans the live anchor resolver on every re-open', () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    stubBoundingRect(host, { left: 0, top: 0, width: 40, height: 40 });
    const removedStartupPane = document.createElement('div');
    document.body.appendChild(removedStartupPane);
    stubBoundingRect(removedStartupPane, { left: 0, top: 0, width: 100, height: 100 });
    const largestPerspective = document.createElement('div');
    document.body.appendChild(largestPerspective);
    stubBoundingRect(largestPerspective, { left: 400, top: 80, width: 500, height: 400 });
    let liveAnchor: HTMLElement | null = removedStartupPane;
    panel = new TestFloatingPanel(host, removedStartupPane);
    panel.setDefaultAnchorResolver(() => liveAnchor);
    stubPanelRectFromStyle(panel.getRootElement(), 120, 80);
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1600 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });
    panel.show();
    expect(panel.getRootElement().style.left).toBe('8px');
    panel.hide();
    removedStartupPane.remove();
    liveAnchor = largestPerspective;
    panel.show();
    expect(panel.getRootElement().style.left).toBe('408px');
    expect(panel.getRootElement().style.top).toBe('392px');
    expect(panel.getDefaultAnchor()).toBe(largestPerspective);
    largestPerspective.remove();
  });

  it('ignores a disconnected static anchor when no live resolver is set', () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    stubBoundingRect(host, { left: 20, top: 30, width: 300, height: 200 });
    const detachedAnchor = document.createElement('div');
    document.body.appendChild(detachedAnchor);
    stubBoundingRect(detachedAnchor, { left: 0, top: 0, width: 50, height: 50 });
    panel = new TestFloatingPanel(host, detachedAnchor);
    stubPanelRectFromStyle(panel.getRootElement(), 120, 80);
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1200 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 });
    detachedAnchor.remove();
    panel.show();
    expect(panel.getRootElement().style.left).toBe('28px');
    expect(panel.getRootElement().style.top).toBe('142px');
    expect(panel.getDefaultAnchor()).toBeNull();
  });

  it('registers with the stack and unregisters on dispose', () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    panel = new TestFloatingPanel(host);
    panel.show();
    expect(FloatingPanelStack.getRegisteredCount()).toBe(1);
    panel.dispose();
    panel = null;
    expect(FloatingPanelStack.getRegisteredCount()).toBe(0);
  });
});

/** Non-modal centered panel with a draggable title bar. */
class TestCenteredPanel extends PanelFloating {
  /** Title bar element the tests drag. */
  readonly titleBar: HTMLElement;

  /**
   * Creates a non-modal centered panel with a draggable title bar.
   *
   * @param host Host element the panel centers in.
   * @param width Panel width in pixels.
   * @param height Panel height in pixels.
   */
  constructor(host: HTMLElement, width: number, height: number) {
    super(host, { corner: 'bottom-left', centered: true, paddingPx: 8 });
    this.titleBar = document.createElement('div');
    this.bindTitleBarDrag(this.titleBar);
    this.root.appendChild(this.titleBar);
    this.root.style.width = `${width}px`;
    this.root.style.height = `${height}px`;
  }
}

describe('FloatingPanel non-modal centered placement', () => {
  const panelWidth = 120;
  const panelHeight = 80;
  const hostRect = { left: 100, top: 50, width: 800, height: 600 };
  let host: HTMLElement;
  let panel: PanelFloating | null;

  beforeEach(() => {
    FloatingPanelStack.resetForTests();
    windowSizeSet(hostRect.left + hostRect.width + 200, hostRect.top + hostRect.height + 200);
    host = document.createElement('div');
    document.body.appendChild(host);
    stubBoundingRect(host, hostRect);
  });

  afterEach(() => {
    panel?.dispose();
    panel = null;
    host.remove();
    FloatingPanelStack.resetForTests();
  });

  /**
   * Creates and returns a centered panel whose rect follows its style.
   *
   * @returns Centered test panel.
   */
  function centeredPanelCreate(): TestCenteredPanel {
    const centeredPanel = new TestCenteredPanel(host, panelWidth, panelHeight);
    stubPanelRectFromStyle(centeredPanel.getRootElement(), panelWidth, panelHeight);
    panel = centeredPanel;
    return centeredPanel;
  }

  it('centers in the host on first show without a backdrop', () => {
    const centeredPanel = centeredPanelCreate();
    centeredPanel.show();
    const position = panelLeftTopRead(centeredPanel);
    expect(centeredPanel.getBackdropElement()).toBeNull();
    expect(centeredPanel.getRootElement().style.position).toBe('fixed');
    expect(position.left + panelWidth / 2).toBeCloseTo(hostRect.left + hostRect.width / 2, 0);
    expect(position.top + panelHeight / 2).toBeCloseTo(hostRect.top + hostRect.height / 2, 0);
  });

  it('keeps the dragged position when shown again', () => {
    const centeredPanel = centeredPanelCreate();
    centeredPanel.show();
    const centeredPosition = panelLeftTopRead(centeredPanel);
    const dragDelta = { x: -70, y: 45 };
    titleBarDrag(
      centeredPanel.titleBar,
      centeredPosition.left + 10,
      centeredPosition.top + 5,
      dragDelta.x,
      dragDelta.y,
    );
    const draggedPosition = panelLeftTopRead(centeredPanel);
    expect(draggedPosition.left).toBeCloseTo(centeredPosition.left + dragDelta.x, 0);
    expect(draggedPosition.top).toBeCloseTo(centeredPosition.top + dragDelta.y, 0);
    centeredPanel.hide();
    centeredPanel.show();
    expect(panelLeftTopRead(centeredPanel)).toEqual(draggedPosition);
  });

  it('clamps the kept position into the window when the window shrinks', () => {
    const centeredPanel = centeredPanelCreate();
    centeredPanel.show();
    const position = panelLeftTopRead(centeredPanel);
    const padding = 8;
    const shrunkWidth = position.left + panelWidth / 2;
    const shrunkHeight = position.top + panelHeight / 2;
    windowSizeSet(shrunkWidth, shrunkHeight);
    window.dispatchEvent(new Event('resize'));
    const clamped = panelLeftTopRead(centeredPanel);
    expect(clamped.left + panelWidth).toBeLessThanOrEqual(shrunkWidth - padding);
    expect(clamped.top + panelHeight).toBeLessThanOrEqual(shrunkHeight - padding);
    centeredPanel.hide();
    centeredPanel.show();
    expect(panelLeftTopRead(centeredPanel)).toEqual(clamped);
  });

  it('keeps corner panels snapping back to their corner on every show', () => {
    const cornerPanel = new TestFloatingPanel(host);
    stubPanelRectFromStyle(cornerPanel.getRootElement(), panelWidth, panelHeight);
    panel = cornerPanel;
    cornerPanel.show();
    const cornerPosition = panelLeftTopRead(cornerPanel);
    expect(cornerPosition.left).toBe(hostRect.left + 8);
    expect(cornerPosition.top).toBe(hostRect.top + hostRect.height - panelHeight - 8);
    const title = cornerPanel.getRootElement().querySelector('[data-test-title="1"]') as HTMLElement;
    titleBarDrag(title, cornerPosition.left + 10, cornerPosition.top + 5, 60, -40);
    expect(panelLeftTopRead(cornerPanel)).not.toEqual(cornerPosition);
    cornerPanel.hide();
    cornerPanel.show();
    expect(panelLeftTopRead(cornerPanel)).toEqual(cornerPosition);
  });
});

/** Modal non-draggable panel for dialog feature tests. */
class TestModalPanel extends PanelFloating {
  /**
   * Creates a centered modal panel with a title bar that cannot drag.
   *
   * @param host Host element.
   */
  constructor(host: HTMLElement) {
    super(host, {
      corner: 'top-left',
      modal: true,
      centered: true,
      draggable: false,
      closeOnEscape: true,
      closeOnBackdropClick: true,
      stackLayer: 'modal',
      backdropClassName: 'test-modal-backdrop',
    });
    const title = document.createElement('div');
    title.dataset['testTitle'] = '1';
    title.textContent = 'Modal';
    this.bindTitleBarDrag(title);
    this.root.appendChild(title);
    this.root.style.width = '200px';
    this.root.style.height = '120px';
  }
}

describe('FloatingPanel modal options', () => {
  let host: HTMLElement;
  let panel: TestModalPanel | null;

  beforeEach(() => {
    FloatingPanelStack.resetForTests();
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    panel?.dispose();
    panel = null;
    host?.remove();
    FloatingPanelStack.resetForTests();
  });

  it('starts hidden with a backdrop and opens as a modal', () => {
    panel = new TestModalPanel(host);
    const backdrop = panel.getBackdropElement();
    expect(backdrop).toBeTruthy();
    expect(backdrop?.style.display).toBe('none');
    expect(host.contains(backdrop)).toBe(false);
    expect(panel.isMountedInHost()).toBe(false);
    panel.show();
    expect(panel.isOpen()).toBe(true);
    expect(panel.isMountedInHost()).toBe(true);
    expect(host.contains(backdrop)).toBe(true);
    expect(backdrop?.style.display).toBe('flex');
    expect(panel.getRootElement().style.display).toBe('flex');
  });

  it('closes on Escape and backdrop pointer down', () => {
    panel = new TestModalPanel(host);
    panel.show();
    const backdrop = panel.getBackdropElement();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(panel.isOpen()).toBe(false);
    expect(host.contains(backdrop)).toBe(false);
    panel.show();
    expect(host.contains(backdrop)).toBe(true);
    backdrop?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(panel.isOpen()).toBe(false);
    expect(host.contains(backdrop)).toBe(false);
  });

  it('does not start drag when draggable is false', () => {
    panel = new TestModalPanel(host);
    panel.show();
    const title = panel.getRootElement().querySelector('[data-test-title="1"]') as HTMLElement;
    const beforeLeft = panel.getRootElement().style.left;
    title.dispatchEvent(new PointerEvent('pointerdown', { button: 0, clientX: 40, clientY: 20, bubbles: true }));
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 140, clientY: 80, bubbles: true }));
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    expect(panel.getRootElement().style.left).toBe(beforeLeft);
  });
});
