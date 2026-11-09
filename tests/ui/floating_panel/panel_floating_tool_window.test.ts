import { afterEach, describe, expect, it, vi } from 'vitest';
import { PanelFloatingToolWindow } from '@/ui/floating_panel/panel_floating_tool_window.js';

/** Tool window exposing its body and cleanup registration to the test. */
class PanelFloatingToolWindowTest extends PanelFloatingToolWindow {
  /**
   * Creates the test window.
   *
   * @param host Parent element hosting floating panels.
   * @param titleText Title bar text.
   */
  constructor(host: HTMLElement, titleText: string) {
    super(host, {
      titleText,
      className: 'panel-floating-tool-window-test',
      width: '200px',
      floating: { centered: true, draggable: true, closeOnEscape: true },
    });
  }

  /**
   * Returns the window body.
   *
   * @returns Body element.
   */
  bodyRead(): HTMLElement {
    return this.body;
  }

  /**
   * Registers a cleanup function.
   *
   * @param disposer Cleanup function.
   */
  disposerRegister(disposer: () => void): void {
    this.disposerAdd(disposer);
  }
}

/** Windows built by the running test. */
const panelFloatingToolWindowTests: PanelFloatingToolWindowTest[] = [];

afterEach(() => {
  panelFloatingToolWindowTests.splice(0).forEach((toolWindow) => toolWindow.dispose());
  document.body.replaceChildren();
});

/**
 * Creates a test window remembered for cleanup.
 *
 * @param titleText Title bar text.
 * @returns Test window.
 */
function panelFloatingToolWindowTestCreate(titleText: string): PanelFloatingToolWindowTest {
  const toolWindow = new PanelFloatingToolWindowTest(document.body, titleText);
  panelFloatingToolWindowTests.push(toolWindow);
  return toolWindow;
}

/** Floating tool window base class. */
describe('PanelFloatingToolWindow', () => {
  it('builds a classed root with a title bar followed by the body', () => {
    const toolWindow = panelFloatingToolWindowTestCreate('Tool Window Title');
    const root = toolWindow.getRootElement();
    expect(root.classList.contains('panel-floating-tool-window-test')).toBe(true);
    expect(root.lastElementChild).toBe(toolWindow.bodyRead());
    expect(root.firstElementChild?.textContent).toContain('Tool Window Title');
    expect(root.querySelector('button[title="Close"]')).not.toBeNull();
  });

  it('closes from its close button and from Escape', () => {
    const toolWindow = panelFloatingToolWindowTestCreate('Closing');
    toolWindow.show();
    toolWindow.getRootElement().querySelector<HTMLButtonElement>('button[title="Close"]')?.click();
    expect(toolWindow.isOpen()).toBe(false);
    toolWindow.show();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(toolWindow.isOpen()).toBe(false);
  });

  it('runs every registered cleanup exactly once and removes itself on dispose', () => {
    const toolWindow = panelFloatingToolWindowTestCreate('Cleanup');
    const disposers = [vi.fn(), vi.fn()];
    disposers.forEach((disposer) => toolWindow.disposerRegister(disposer));
    toolWindow.show();
    toolWindow.dispose();
    toolWindow.dispose();
    disposers.forEach((disposer) => expect(disposer).toHaveBeenCalledOnce());
    expect(document.body.contains(toolWindow.getRootElement())).toBe(false);
  });
});
