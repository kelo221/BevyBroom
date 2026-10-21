import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ViewportToolChromeHost,
  type ViewportToolChromeHandlers,
} from '@/tools/chrome/host/viewport_tool_chrome_host.js';
import {
  VIEWPORT_TOOL_CHROME_DOCKED_CLASS,
  viewportToolChromeDockedStripStyle,
  type ViewportToolChromeDocking,
} from '@/tools/chrome/host/viewport_tool_chrome_docking.js';
import { EditorToolId } from '@/types/editor_tool_id.js';
import { EditorInteractionMode } from '@/types/editor_interaction_mode.js';
import { FloatingPanelStack } from '@/ui/floating_panel/panel_floating_stack.js';

/** Class of the tool buttons strip root. */
const VIEWPORT_TOOL_CHROME_DOCKED_TEST_RAIL_CLASS = 'editor-viewport-tool-rail';

/** Class of the tool options strip root. */
const VIEWPORT_TOOL_CHROME_DOCKED_TEST_OPTIONS_CLASS = 'editor-viewport-tool-options-bar';

/** Hosts built by the running test. */
const viewportToolChromeDockedTestHosts: ViewportToolChromeHost[] = [];

/**
 * Creates chrome handlers where every required callback is a spy.
 *
 * @returns Chrome handlers.
 */
function viewportToolChromeDockedTestHandlersCreate(): ViewportToolChromeHandlers {
  return {
    onSelectTool: vi.fn(),
    onTransformMode: vi.fn(),
    onFlipClipPlane: vi.fn(),
    onCommitClip: vi.fn(),
    onCommitSplit: vi.fn(),
    faceInspectorReveal: vi.fn(),
    onExtrudeFaces: vi.fn(),
    onGridReset: vi.fn(),
    onGridAlignToFace: vi.fn(),
    onGridAlignAxis: vi.fn(),
    onGridOriginVertex: vi.fn(),
    onCameraReset: vi.fn(),
    onCameraAlignToFace: vi.fn(),
    onInteractionMode: vi.fn(),
    onComponentMode: vi.fn(),
  };
}

/**
 * Creates two mounted bar elements that receive docked chrome.
 *
 * @returns Docking with separate rail and options parents.
 */
function viewportToolChromeDockedTestDockingCreate(): ViewportToolChromeDocking {
  const railParent = document.createElement('div');
  const optionsParent = document.createElement('div');
  document.body.append(railParent, optionsParent);
  return { railParent, optionsParent };
}

/**
 * Creates docked chrome and remembers it for cleanup.
 *
 * @param docking Parents of the strips.
 * @param handlers Chrome handlers.
 * @returns Docked chrome host.
 */
function viewportToolChromeDockedTestHostCreate(
  docking: ViewportToolChromeDocking,
  handlers: ViewportToolChromeHandlers = viewportToolChromeDockedTestHandlersCreate(),
): ViewportToolChromeHost {
  const host = ViewportToolChromeHost.dockedCreate(docking, handlers);
  viewportToolChromeDockedTestHosts.push(host);
  return host;
}

/**
 * Returns the strip root with a class directly inside a parent.
 *
 * @param parent Parent element.
 * @param className Strip class.
 * @returns Strip element, or null when the parent has no such direct child.
 */
function viewportToolChromeDockedTestStripRead(parent: HTMLElement, className: string): HTMLElement | null {
  return [...parent.children].find((child): child is HTMLElement => child.classList.contains(className)) ?? null;
}

/**
 * Returns the strip root with a class directly inside a parent, failing when
 * absent.
 *
 * @param parent Parent element.
 * @param className Strip class.
 * @returns Strip element.
 */
function viewportToolChromeDockedTestStripRequire(parent: HTMLElement, className: string): HTMLElement {
  const strip = viewportToolChromeDockedTestStripRead(parent, className);
  if (!strip) {
    throw new Error(`Strip ${className} not found`);
  }
  return strip;
}

afterEach(() => {
  viewportToolChromeDockedTestHosts.splice(0).forEach((host) => host.dispose());
  document.body.replaceChildren();
});

describe('ViewportToolChromeHost docked', () => {
  it('mounts the tool buttons into the rail parent and the options into the options parent', () => {
    const docking = viewportToolChromeDockedTestDockingCreate();
    viewportToolChromeDockedTestHostCreate(docking);
    expect(
      viewportToolChromeDockedTestStripRead(docking.railParent, VIEWPORT_TOOL_CHROME_DOCKED_TEST_RAIL_CLASS),
    ).not.toBeNull();
    expect(
      viewportToolChromeDockedTestStripRead(docking.optionsParent, VIEWPORT_TOOL_CHROME_DOCKED_TEST_OPTIONS_CLASS),
    ).not.toBeNull();
    expect(
      viewportToolChromeDockedTestStripRead(docking.railParent, VIEWPORT_TOOL_CHROME_DOCKED_TEST_OPTIONS_CLASS),
    ).toBeNull();
    expect(
      viewportToolChromeDockedTestStripRead(docking.optionsParent, VIEWPORT_TOOL_CHROME_DOCKED_TEST_RAIL_CLASS),
    ).toBeNull();
  });

  it('reports docked chrome as docked and floating chrome as not docked', () => {
    const docking = viewportToolChromeDockedTestDockingCreate();
    const docked = viewportToolChromeDockedTestHostCreate(docking);
    const pane = document.createElement('div');
    document.body.appendChild(pane);
    const floating = new ViewportToolChromeHost(pane, viewportToolChromeDockedTestHandlersCreate(), () => undefined);
    viewportToolChromeDockedTestHosts.push(floating);
    expect(docked.isDocked()).toBe(true);
    expect(floating.isDocked()).toBe(false);
    expect(pane.querySelector(`.${VIEWPORT_TOOL_CHROME_DOCKED_CLASS}`)).toBeNull();
  });

  it('styles both strips as inline bar rows', () => {
    const docking = viewportToolChromeDockedTestDockingCreate();
    viewportToolChromeDockedTestHostCreate(docking);
    const strips = [
      viewportToolChromeDockedTestStripRequire(docking.railParent, VIEWPORT_TOOL_CHROME_DOCKED_TEST_RAIL_CLASS),
      viewportToolChromeDockedTestStripRequire(docking.optionsParent, VIEWPORT_TOOL_CHROME_DOCKED_TEST_OPTIONS_CLASS),
    ];
    strips.forEach((strip) => {
      expect(strip.classList.contains(VIEWPORT_TOOL_CHROME_DOCKED_CLASS)).toBe(true);
      expect(strip.style.position).toBe('static');
      expect(strip.style.flexDirection).toBe('row');
    });
  });

  it('shows both strips right away and keeps them shown when hover ownership changes', () => {
    const docking = viewportToolChromeDockedTestDockingCreate();
    const host = viewportToolChromeDockedTestHostCreate(docking);
    const rail = viewportToolChromeDockedTestStripRequire(
      docking.railParent,
      VIEWPORT_TOOL_CHROME_DOCKED_TEST_RAIL_CLASS,
    );
    const options = viewportToolChromeDockedTestStripRequire(
      docking.optionsParent,
      VIEWPORT_TOOL_CHROME_DOCKED_TEST_OPTIONS_CLASS,
    );
    [false, true, false].forEach((owned) => {
      host.setHoverOwned(owned);
      expect(host.isHoverOwned()).toBe(true);
      expect(rail.style.display).toBe('flex');
      expect(options.style.display).toBe('flex');
    });
  });

  it('selects a tool from a docked rail button', () => {
    const docking = viewportToolChromeDockedTestDockingCreate();
    const handlers = viewportToolChromeDockedTestHandlersCreate();
    viewportToolChromeDockedTestHostCreate(docking, handlers);
    const faceButton = [...docking.railParent.querySelectorAll('button')].find(
      (button) => button.getAttribute('aria-label') === 'Face Select',
    );
    faceButton?.click();
    expect(handlers.onSelectTool).toHaveBeenCalledWith(EditorToolId.FACE);
  });

  it('still hides rail tools not available in Edit Mode while docked', () => {
    const docking = viewportToolChromeDockedTestDockingCreate();
    const host = viewportToolChromeDockedTestHostCreate(docking);
    host.setActiveInteractionMode(EditorInteractionMode.EDIT_MODE);
    const faceButton = [...docking.railParent.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.getAttribute('aria-label') === 'Face Select',
    );
    expect(faceButton?.style.display).toBe('none');
  });

  it('registers docked strips as pointer-block surfaces and removes everything on dispose', () => {
    const docking = viewportToolChromeDockedTestDockingCreate();
    const host = ViewportToolChromeHost.dockedCreate(docking, viewportToolChromeDockedTestHandlersCreate());
    const rail = viewportToolChromeDockedTestStripRequire(
      docking.railParent,
      VIEWPORT_TOOL_CHROME_DOCKED_TEST_RAIL_CLASS,
    );
    expect(FloatingPanelStack.containsEventTarget(rail)).toBe(true);
    host.dispose();
    expect(FloatingPanelStack.containsEventTarget(rail)).toBe(false);
    expect(docking.railParent.childElementCount).toBe(0);
    expect(docking.optionsParent.childElementCount).toBe(0);
  });
});

describe('viewportToolChromeDockedStripStyle', () => {
  it('turns a floating strip into an inline row without floating chrome', () => {
    const strip = document.createElement('div');
    strip.style.position = 'absolute';
    strip.style.left = '12px';
    strip.style.top = '30px';
    strip.style.flexDirection = 'column';
    strip.style.boxShadow = '0 10px 28px rgba(0,0,0,0.55)';
    strip.style.borderRadius = '8px';
    viewportToolChromeDockedStripStyle(strip);
    expect(strip.classList.contains(VIEWPORT_TOOL_CHROME_DOCKED_CLASS)).toBe(true);
    expect(strip.style.position).toBe('static');
    expect(strip.style.left).toBe('');
    expect(strip.style.top).toBe('');
    expect(strip.style.flexDirection).toBe('row');
    expect(strip.style.boxShadow).toBe('none');
    expect(parseFloat(strip.style.borderRadius)).toBe(0);
  });
});
