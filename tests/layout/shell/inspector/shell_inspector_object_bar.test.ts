import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ShellInspectorObjectBar,
  type ShellInspectorObjectBarHandlers,
} from '@/layout/shell/inspector/shell_inspector_object_bar.js';
import { StateSelectionFilter } from '@/selection/filter/state_selection_filter.js';
import { StateTexturePaint } from '@/texture/paint/state_texture_paint.js';
import { SelectionFilterMode } from '@/types/selection_filter_mode.js';
import type { FaceAttributesMaterialDescription } from '@/texture/ui/face_attributes/face_attributes_material_row.js';

/** Image size every described test texture reports. */
const OBJECT_BAR_TEST_TEXTURE_SIZE = { width: 128, height: 64 };

/** Object bars built by the running test. */
const objectBarTestBars: ShellInspectorObjectBar[] = [];

/** Handlers with spy actions and the paint state an Object Bar test works with. */
interface ObjectBarTestRig {
  readonly bar: ShellInspectorObjectBar;
  readonly handlers: ShellInspectorObjectBarHandlers;
  readonly filterState: StateSelectionFilter;
  readonly paintState: StateTexturePaint;
}

/**
 * Describes a texture with a display name derived from its id and the shared
 * test size.
 *
 * @param textureId Texture identity.
 * @returns Description of the texture.
 */
function objectBarTestTextureDescribe(textureId: string): FaceAttributesMaterialDescription {
  return { displayName: `Shown ${textureId}`, previewObjectUrl: null, sizePixels: OBJECT_BAR_TEST_TEXTURE_SIZE };
}

/**
 * Builds a mounted Object Bar with spy Browse and Replace actions.
 *
 * @returns Object Bar test rig.
 */
function objectBarTestRigCreate(): ObjectBarTestRig {
  const handlers: ShellInspectorObjectBarHandlers = {
    textureBrowse: vi.fn(),
    textureReplace: vi.fn(),
    textureDescribe: objectBarTestTextureDescribe,
  };
  const filterState = new StateSelectionFilter();
  const paintState = new StateTexturePaint();
  const bar = new ShellInspectorObjectBar(handlers, filterState, paintState);
  document.body.appendChild(bar.getElement());
  objectBarTestBars.push(bar);
  return { bar, handlers, filterState, paintState };
}

/**
 * Reads the text of the first element matching a selector inside the bar.
 *
 * @param bar Object Bar.
 * @param selector CSS selector.
 * @returns Text content, or null when nothing matches.
 */
function objectBarTestTextRead(bar: ShellInspectorObjectBar, selector: string): string | null {
  return bar.getElement().querySelector(selector)?.textContent ?? null;
}

afterEach(() => {
  objectBarTestBars.splice(0).forEach((bar) => bar.dispose());
  document.body.replaceChildren();
});

describe('ShellInspectorObjectBar', () => {
  it('renders Groups, Objects and Solids buttons synced with StateSelectionFilter', () => {
    const { bar, filterState } = objectBarTestRigCreate();
    const groupsButton = bar.getElement().querySelector<HTMLButtonElement>('[data-select-filter-mode="groups"]');
    const solidsButton = bar.getElement().querySelector<HTMLButtonElement>('[data-select-filter-mode="solids"]');
    expect(groupsButton).not.toBeNull();
    expect(solidsButton).not.toBeNull();
    groupsButton?.click();
    expect(filterState.modeRead()).toBe(SelectionFilterMode.GROUPS);
    expect(groupsButton?.dataset['active']).toBe('true');
    filterState.modeWrite(SelectionFilterMode.SOLIDS);
    expect(solidsButton?.dataset['active']).toBe('true');
  });

  it('shows the Hammer++ Select and Current texture captions', () => {
    const { bar } = objectBarTestRigCreate();
    const text = bar.getElement().textContent ?? '';
    expect(text).toContain('Select:');
    expect(text).toContain('Current texture:');
  });

  it('shows the described name and size of the paint texture and follows paint changes', () => {
    const { bar, paintState } = objectBarTestRigCreate();
    const textureId = `test/texture_${Math.random().toString(36).slice(2)}`;
    paintState.setLastTextureId(textureId);
    expect(objectBarTestTextRead(bar, '.shell-inspector-current-texture-name')).toBe(`Shown ${textureId}`);
    expect(objectBarTestTextRead(bar, '.shell-inspector-current-texture-size')).toBe(
      `${OBJECT_BAR_TEST_TEXTURE_SIZE.width}×${OBJECT_BAR_TEST_TEXTURE_SIZE.height}`,
    );
    expect(bar.getElement().querySelector('.shell-inspector-current-texture-thumbnail')).not.toBeNull();
  });

  it('runs Browse and runs Replace with the current paint texture', () => {
    const { bar, handlers, paintState } = objectBarTestRigCreate();
    const textureId = `test/replace_${Math.random().toString(36).slice(2)}`;
    paintState.setLastTextureId(textureId);
    bar.getElement().querySelector<HTMLButtonElement>('.shell-inspector-texture-browse')?.click();
    bar.getElement().querySelector<HTMLButtonElement>('.shell-inspector-texture-replace')?.click();
    expect(handlers.textureBrowse).toHaveBeenCalledTimes(1);
    expect(handlers.textureReplace).toHaveBeenCalledWith(textureId);
  });

  it('stops following the paint state after dispose', () => {
    const { bar, paintState } = objectBarTestRigCreate();
    const nameBefore = objectBarTestTextRead(bar, '.shell-inspector-current-texture-name');
    bar.dispose();
    paintState.setLastTextureId(`test/after_${Math.random().toString(36).slice(2)}`);
    expect(objectBarTestTextRead(bar, '.shell-inspector-current-texture-name')).toBe(nameBefore);
    expect(bar.getElement().isConnected).toBe(false);
  });
});
