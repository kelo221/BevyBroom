import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  FaceAttributesUvToolStrip,
  type FaceAttributesUvToolStripHandlers,
} from '@/texture/ui/face_attributes/face_attributes_uv_tool_strip.js';
import type { FaceUvToolSelectionStatus } from '@/texture/controller/controller_face_uv_tools.js';

describe('FaceAttributesUvToolStrip', () => {
  let host: HTMLElement;
  let handlers: Record<keyof FaceAttributesUvToolStripHandlers, ReturnType<typeof vi.fn>>;
  let strip: FaceAttributesUvToolStrip;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    handlers = {
      onFit: vi.fn(),
      onJustify: vi.fn(),
      onAlignEdge: vi.fn(),
      onFlip: vi.fn(),
      onRotate: vi.fn(),
      onResetFace: vi.fn(),
      onResetWorld: vi.fn(),
      onShearCommit: vi.fn(),
    };
    strip = new FaceAttributesUvToolStrip(handlers as FaceAttributesUvToolStripHandlers);
    host.appendChild(strip.getElement());
  });

  afterEach(() => {
    strip.dispose();
    host.remove();
  });

  it('runs the operation behind every tool button', () => {
    clickButton('Fit H');
    expect(handlers.onFit).toHaveBeenCalledWith('u');
    clickButton('Fit V');
    expect(handlers.onFit).toHaveBeenCalledWith('v');
    clickButton('Fit');
    expect(handlers.onFit).toHaveBeenCalledWith('both');
    clickButton('Justify ←');
    expect(handlers.onJustify).toHaveBeenCalledWith('left');
    clickButton('Align');
    expect(handlers.onAlignEdge).toHaveBeenCalledWith('best');
    clickButton('Align ◀');
    expect(handlers.onAlignEdge).toHaveBeenCalledWith('previous');
    clickButton('Align ▶');
    expect(handlers.onAlignEdge).toHaveBeenCalledWith('next');
    clickButton('Flip H');
    expect(handlers.onFlip).toHaveBeenCalledWith('horizontal');
    clickButton('Flip V');
    expect(handlers.onFlip).toHaveBeenCalledWith('vertical');
    clickButton('Rot −90');
    expect(handlers.onRotate).toHaveBeenCalledWith(-90);
    clickButton('Rot 90');
    expect(handlers.onRotate).toHaveBeenCalledWith(90);
    clickButton('Reset Face');
    expect(handlers.onResetFace).toHaveBeenCalled();
    clickButton('Reset World');
    expect(handlers.onResetWorld).toHaveBeenCalled();
  });

  it('highlights satisfied fit buttons and clears them without a status', () => {
    strip.setFromStatus(statusWith({ fittedU: true, fittedV: true }));
    expect(buttonByName('Fit H').style.borderColor).not.toBe(buttonByName('Flip H').style.borderColor);
    strip.setFromStatus(null);
    expect(buttonByName('Fit H').style.borderColor).toBe(buttonByName('Flip H').style.borderColor);
  });

  it('highlights the justify button of the satisfied side', () => {
    strip.setFromStatus(statusWith({ justifiedLeft: true }));
    const left = buttonByName('Justify ←');
    const right = buttonByName('Justify →');
    expect(left.style.background).not.toBe(right.style.background);
  });

  it('commits shear field values with their mode', () => {
    strip.setShearValues(0.25, null);
    const shearUInput = shearInput(host, 'Shear U');
    shearUInput.value = '0.5';
    shearUInput.dispatchEvent(new Event('change', { bubbles: true }));
    expect(handlers.onShearCommit).toHaveBeenCalledWith('u-by-v', 0.5);
  });

  it('shows the shared shear values in both fields', () => {
    strip.setShearValues(0.25, -0.75);
    expect(shearInput(host, 'Shear U').value).toContain('0.25');
    expect(shearInput(host, 'Shear V').value).toContain('0.75');
  });
});

/**
 * Clicks one tool button by its accessible name.
 *
 * @param name Accessible name of the button.
 */
function clickButton(name: string): void {
  const button = buttonByName(name);
  button.click();
}

/**
 * Finds one tool button by its accessible name.
 *
 * @param name Accessible name of the button.
 * @returns Button element.
 */
function buttonByName(name: string): HTMLButtonElement {
  const button = document.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`);
  if (!button) {
    throw new Error(`button not found: ${name}`);
  }
  return button;
}

/**
 * Builds a status with every flag false except the given overrides.
 *
 * @param overrides Flags set to true.
 * @returns Status flags.
 */
function statusWith(overrides: Partial<FaceUvToolSelectionStatus>): FaceUvToolSelectionStatus {
  return {
    fittedU: false,
    fittedV: false,
    justifiedLeft: false,
    justifiedRight: false,
    justifiedTop: false,
    justifiedBottom: false,
    justifiedCenter: false,
    aligned: false,
    ...overrides,
  };
}

/**
 * Finds the numeric input of one shear field.
 *
 * @param host Strip host element.
 * @param label Field label.
 * @returns Input element.
 */
function shearInput(host: HTMLElement, label: string): HTMLInputElement {
  const cell = Array.from(host.querySelectorAll('div')).find((element) => element.textContent?.startsWith(label));
  const input = cell?.querySelector('input');
  if (!input) {
    throw new Error(`shear field not found: ${label}`);
  }
  return input as HTMLInputElement;
}
