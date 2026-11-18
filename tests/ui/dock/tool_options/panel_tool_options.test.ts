import { afterEach, describe, expect, it, vi } from 'vitest';
import { PANEL_TOOL_OPTIONS_SHOWN_EVENT, PanelToolOptions } from '@/ui/dock/tool_options/panel_tool_options.js';

/** Tool options section exposing its body, hooks and cleanup to the test. */
class PanelToolOptionsTest extends PanelToolOptions {
  readonly shownCalls: string[] = [];

  /**
   * Creates the test section.
   *
   * @param host Element the section is shown in.
   * @param titleText Title row text.
   */
  constructor(host: HTMLElement, titleText: string) {
    super(host, { titleText, className: 'panel-tool-options-test' });
  }

  /**
   * Returns the section body.
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

  /** Records that the section was shown. */
  protected override onAfterShow(): void {
    this.shownCalls.push('shown');
  }

  /** Records that the section was hidden. */
  protected override onAfterHide(): void {
    this.shownCalls.push('hidden');
  }
}

/** Sections built by the running test. */
const panelToolOptionsTests: PanelToolOptionsTest[] = [];

afterEach(() => {
  panelToolOptionsTests.splice(0).forEach((section) => section.dispose());
  document.body.replaceChildren();
});

/**
 * Creates a test section in a fresh host remembered for cleanup.
 *
 * @param titleText Title row text.
 * @returns Section and its host.
 */
function panelToolOptionsTestCreate(titleText: string): { section: PanelToolOptionsTest; host: HTMLElement } {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const section = new PanelToolOptionsTest(host, titleText);
  panelToolOptionsTests.push(section);
  return { section, host };
}

/** Base of the tool options sections of the right dock. */
describe('PanelToolOptions', () => {
  it('builds a classed section with a title row and a Close button above the body', () => {
    const { section } = panelToolOptionsTestCreate('Tool Options Title');
    const root = section.getRootElement();
    expect(root.classList.contains('panel-tool-options-test')).toBe(true);
    expect(root.lastElementChild).toBe(section.bodyRead());
    expect(root.firstElementChild?.textContent).toContain('Tool Options Title');
    expect(root.querySelector('button[title="Close"]')).not.toBeNull();
  });

  it('is inside its host only while shown and runs its hooks in order', () => {
    const { section, host } = panelToolOptionsTestCreate('Shown');
    expect(host.contains(section.getRootElement())).toBe(false);
    section.show();
    expect(section.isOpen()).toBe(true);
    expect(host.contains(section.getRootElement())).toBe(true);
    section.toggle();
    expect(host.contains(section.getRootElement())).toBe(false);
    expect(section.shownCalls).toEqual(['shown', 'hidden']);
  });

  it('closes from its Close button', () => {
    const { section } = panelToolOptionsTestCreate('Closing');
    section.show();
    section.getRootElement().querySelector<HTMLButtonElement>('button[title="Close"]')?.click();
    expect(section.isOpen()).toBe(false);
  });

  it('tells the elements around it when it is shown, so the dock can reveal itself', () => {
    const { section, host } = panelToolOptionsTestCreate('Announced');
    const listener = vi.fn();
    host.addEventListener(PANEL_TOOL_OPTIONS_SHOWN_EVENT, listener);
    section.show();
    section.show();
    expect(listener).toHaveBeenCalledOnce();
  });

  it('runs registered disposers once on dispose', () => {
    const { section } = panelToolOptionsTestCreate('Disposing');
    const disposer = vi.fn();
    section.disposerRegister(disposer);
    section.show();
    section.dispose();
    section.dispose();
    expect(disposer).toHaveBeenCalledOnce();
    expect(section.isOpen()).toBe(false);
  });
});
