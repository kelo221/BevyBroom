import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import {
  FaceAttributesEditor,
  type FaceAttributesEditorHandlers,
} from '@/texture/ui/face_attributes/face_attributes_editor.js';
import type { FaceAttributesMaterialDescription } from '@/texture/ui/face_attributes/face_attributes_material_row.js';
import type { UvEditorTrsFieldState } from '@/texture/uv/face_texture_applier.js';
import { INPUT_NUMERIC_MIXED_VALUE_DISPLAY } from '@/ui/input/input_numeric_parse.js';

/** Material the describer in these tests knows. */
const KNOWN_MATERIAL_ID = 'walls/brick.png';

/** Description returned for the known material. */
const KNOWN_MATERIAL: FaceAttributesMaterialDescription = {
  displayName: 'brick',
  previewObjectUrl: 'blob:brick-preview',
};

/**
 * Proves the docked face attributes editor shows field state, emits edits and
 * nudges through its handlers, and shows the selection's material.
 */
describe('FaceAttributesEditor', () => {
  let host: HTMLElement;
  let handlers: {
    [Key in keyof FaceAttributesEditorHandlers]: Mock<FaceAttributesEditorHandlers[Key]>;
  };
  let editor: FaceAttributesEditor;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    handlers = {
      onAlign: vi.fn<FaceAttributesEditorHandlers['onAlign']>(),
      onApplyPartialTrs: vi.fn<FaceAttributesEditorHandlers['onApplyPartialTrs']>(),
      onRelativeOp: vi.fn<FaceAttributesEditorHandlers['onRelativeOp']>(),
      onReset: vi.fn<FaceAttributesEditorHandlers['onReset']>(),
      onFit: vi.fn<FaceAttributesEditorHandlers['onFit']>(),
      onJustify: vi.fn<FaceAttributesEditorHandlers['onJustify']>(),
      onAlignEdge: vi.fn<FaceAttributesEditorHandlers['onAlignEdge']>(),
      onFlip: vi.fn<FaceAttributesEditorHandlers['onFlip']>(),
      onRotate: vi.fn<FaceAttributesEditorHandlers['onRotate']>(),
      onResetFace: vi.fn<FaceAttributesEditorHandlers['onResetFace']>(),
      onResetWorld: vi.fn<FaceAttributesEditorHandlers['onResetWorld']>(),
      onShearCommit: vi.fn<FaceAttributesEditorHandlers['onShearCommit']>(),
    };
    editor = new FaceAttributesEditor(handlers, (textureId) =>
      textureId === KNOWN_MATERIAL_ID ? KNOWN_MATERIAL : null,
    );
    host.appendChild(editor.getElement());
  });

  afterEach(() => {
    editor.dispose();
    host.remove();
  });

  it('is a docked block that fills its parent width without window chrome', () => {
    const element = editor.getElement();
    expect(element.style.width).toBe('100%');
    expect(element.style.position).toBe('');
    expect(host.querySelector('[aria-label="Close"]')).toBeNull();
  });

  it('shows shared values in the labeled fields', () => {
    const state = createFieldState({ scaleU: 2, scaleV: 0.5, offsetU: 0.25, offsetV: 0.75, rotationDeg: 45 });
    editor.setFromFieldState(state);
    expect(fieldNumber('X Scale')).toBeCloseTo(state.scaleU ?? Number.NaN);
    expect(fieldNumber('Y Scale')).toBeCloseTo(state.scaleV ?? Number.NaN);
    expect(fieldNumber('X Offset')).toBeCloseTo(state.offsetU ?? Number.NaN);
    expect(fieldNumber('Y Offset')).toBeCloseTo(state.offsetV ?? Number.NaN);
    expect(fieldNumber('Rotation')).toBeCloseTo(state.rotationDeg ?? Number.NaN);
  });

  it('shows the mixed dash for fields that differ across the selection', () => {
    editor.setFromFieldState(createFieldState({ scaleU: null, offsetV: null, targetCount: 3 }));
    expect(field('X Scale').value).toBe(INPUT_NUMERIC_MIXED_VALUE_DISPLAY);
    expect(field('Y Offset').value).toBe(INPUT_NUMERIC_MIXED_VALUE_DISPLAY);
    expect(field('Y Scale').value).not.toBe(INPUT_NUMERIC_MIXED_VALUE_DISPLAY);
  });

  it('emits only the typed field while the other fields are mixed', () => {
    editor.setFromFieldState(createMixedFieldState(2));
    commitFieldText('X Scale', '1+1');
    expect(handlers.onApplyPartialTrs).toHaveBeenCalledWith({ scaleU: 2 });
    handlers.onApplyPartialTrs.mockClear();
    editor.setFromFieldState(createMixedFieldState(2));
    commitFieldText('Rotation', '45*2');
    expect(handlers.onApplyPartialTrs).toHaveBeenCalledWith({ rotationDeg: 90 });
  });

  it('fires relative nudges from the buttons even when fields are mixed', () => {
    editor.setFromFieldState(createMixedFieldState(2));
    buttonByTitle('Double X scale (larger tiles)').click();
    expect(handlers.onRelativeOp).toHaveBeenCalledWith({ kind: 'multiplyScale', axis: 'u', factor: 2 });
    buttonByTitle('Rotate +90°').click();
    expect(handlers.onRelativeOp).toHaveBeenCalledWith({ kind: 'addRotation', degrees: 90 });
    buttonByTitle('Shift Y by −¼ tile').click();
    const lastOp = handlers.onRelativeOp.mock.calls.at(-1)?.[0];
    expect(lastOp?.kind === 'addOffset' && lastOp.axis === 'v' && lastOp.delta < 0).toBe(true);
  });

  it('fires align presets and reset from the align strip', () => {
    buttonByTitle('Align to Floor').click();
    buttonByTitle('Align to Wall').click();
    buttonByTitle('Align to Ceiling').click();
    buttonByTitle('Reset UVs').click();
    expect(handlers.onAlign.mock.calls.map((call) => call[0])).toEqual(['floor', 'wall', 'ceiling']);
    expect(handlers.onReset).toHaveBeenCalledTimes(1);
  });

  it('shows the shared material name, preview and region count', () => {
    editor.setFromFieldState(createFieldState({ textureId: KNOWN_MATERIAL_ID, targetCount: 2 }));
    expect(materialNameText()).toBe(KNOWN_MATERIAL.displayName);
    expect(materialPreview().style.backgroundImage).toContain(KNOWN_MATERIAL.previewObjectUrl ?? '');
    expect(host.textContent).toContain('2 face region(s)');
  });

  it('falls back to the texture id for materials the library does not list', () => {
    editor.setFromFieldState(createFieldState({ textureId: 'unknown/id.png', targetCount: 1 }));
    expect(materialNameText()).toBe('unknown/id.png');
    expect(materialPreview().style.backgroundImage).toBe('none');
  });

  it('reports mixed materials and empty selections', () => {
    editor.setFromFieldState(createFieldState({ textureId: null, targetCount: 4 }));
    expect(materialNameText()).toBe('Multiple materials');
    editor.setFromFieldState(createMixedFieldState(0));
    expect(host.textContent).toContain('No surfaces selected');
  });

  /**
   * Returns the field with an accessible name.
   *
   * @param ariaLabel Field accessible name.
   * @returns Input element.
   */
  function field(ariaLabel: string): HTMLInputElement {
    const input = host.querySelector(`input[aria-label="${ariaLabel}"]`);
    if (!(input instanceof HTMLInputElement)) throw new Error(`Missing field ${ariaLabel}`);
    return input;
  }

  /**
   * Parses the number shown in a field.
   *
   * @param ariaLabel Field accessible name.
   * @returns Shown number.
   */
  function fieldNumber(ariaLabel: string): number {
    return Number(field(ariaLabel).value);
  }

  /**
   * Types text into a field and commits it with a change event.
   *
   * @param ariaLabel Field accessible name.
   * @param text Typed text.
   */
  function commitFieldText(ariaLabel: string, text: string): void {
    const input = field(ariaLabel);
    input.value = text;
    input.dispatchEvent(new Event('change'));
  }

  /**
   * Returns the button with a tooltip.
   *
   * @param title Button tooltip.
   * @returns Button element.
   */
  function buttonByTitle(title: string): HTMLButtonElement {
    const button = Array.from(host.querySelectorAll('button')).find((candidate) => candidate.title === title);
    if (!button) throw new Error(`Missing button ${title}`);
    return button;
  }

  /**
   * Returns the shown material name.
   *
   * @returns Material name text.
   */
  function materialNameText(): string {
    return host.querySelector('[data-material-name="true"]')?.textContent ?? '';
  }

  /**
   * Returns the material preview swatch.
   *
   * @returns Swatch element.
   */
  function materialPreview(): HTMLElement {
    const swatch = host.querySelector('[data-material-preview="true"]');
    if (!(swatch instanceof HTMLElement)) throw new Error('Missing material preview');
    return swatch;
  }
});

/**
 * Creates a field state with defaults for every value not given.
 *
 * @param overrides Values to set.
 * @returns Field state.
 */
function createFieldState(overrides: Partial<UvEditorTrsFieldState>): UvEditorTrsFieldState {
  return {
    scaleU: 1,
    scaleV: 1,
    offsetU: 0,
    offsetV: 0,
    rotationDeg: 0,
    align: 'auto',
    textureId: KNOWN_MATERIAL_ID,
    targetCount: 1,
    ...overrides,
  };
}

/**
 * Creates a field state where every value is mixed.
 *
 * @param targetCount Number of selected regions.
 * @returns Field state.
 */
function createMixedFieldState(targetCount: number): UvEditorTrsFieldState {
  return createFieldState({
    scaleU: null,
    scaleV: null,
    offsetU: null,
    offsetV: null,
    rotationDeg: null,
    align: null,
    textureId: null,
    targetCount,
  });
}
