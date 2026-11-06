import { afterEach, describe, expect, it } from 'vitest';
import { getStateDisplacementSculpt } from '@/displacement/state/state_displacement_sculpt.js';
import {
  DISPLACEMENT_SCULPT_AXES,
  DISPLACEMENT_SCULPT_EFFECTS,
  DISPLACEMENT_SCULPT_EDGES,
} from '@/displacement/model/displacement_types.js';
import { DialogDisplacementPaintGeometry } from '@/displacement/ui/paint/dialog_displacement_paint_geometry.js';
import { displacementUiFieldCommit, displacementUiFieldFind } from '../panel_displacement_test_support.js';

/**
 * Returns the last entry of a list, failing when it is empty.
 *
 * @param entries List.
 * @returns Last entry.
 */
function paintGeometryTestLast<Entry>(entries: readonly Entry[]): Entry {
  const last = entries[entries.length - 1];
  if (last === undefined) throw new Error('empty list');
  return last;
}

/**
 * Finds the checked radio of a named radio group.
 *
 * @param root Window root.
 * @param groupLabel Accessible name of the group.
 * @returns Checked value, or null.
 */
function paintGeometryTestCheckedRead(root: HTMLElement, groupLabel: string): string | null {
  const group = displacementUiFieldFind(root, groupLabel);
  return group.querySelector<HTMLInputElement>('input:checked')?.value ?? null;
}

/**
 * Checks the radio of a named radio group holding a value.
 *
 * @param root Window root.
 * @param groupLabel Accessible name of the group.
 * @param value Radio value.
 */
function paintGeometryTestRadioClick(root: HTMLElement, groupLabel: string, value: string): void {
  const radio = displacementUiFieldFind(root, groupLabel).querySelector<HTMLInputElement>(`input[value="${value}"]`);
  if (!radio) throw new Error(`radio ${value} missing`);
  radio.click();
}

/** Displacement Paint Geometry window. */
describe('DialogDisplacementPaintGeometry', () => {
  afterEach(() => {
    getStateDisplacementSculpt().reset();
    document.body.replaceChildren();
  });

  it('writes the effect, edge, axis, raise and bottom-row options into the shared settings', () => {
    const dialog = new DialogDisplacementPaintGeometry(document.body);
    const root = dialog.getRootElement();
    const state = getStateDisplacementSculpt();
    const effect = paintGeometryTestLast(DISPLACEMENT_SCULPT_EFFECTS);
    const edge = paintGeometryTestLast(DISPLACEMENT_SCULPT_EDGES);
    paintGeometryTestRadioClick(root, 'Paint effect', effect);
    paintGeometryTestRadioClick(root, 'Brush edge', edge);
    const axisSelect = displacementUiFieldFind<HTMLSelectElement>(root, 'Paint axis');
    axisSelect.value = paintGeometryTestLast(DISPLACEMENT_SCULPT_AXES);
    axisSelect.dispatchEvent(new Event('change'));
    const before = state.settingsRead();
    ['Raise', 'Spatial', 'AutoSew', 'Continuous Mouse'].forEach((label) =>
      displacementUiFieldFind<HTMLInputElement>(root, label).click(),
    );
    expect(state.settingsRead()).toMatchObject({
      effect,
      edge,
      axis: paintGeometryTestLast(DISPLACEMENT_SCULPT_AXES),
      raise: !before.raise,
      spatial: !before.spatial,
      autoSew: !before.autoSew,
      continuousMouse: !before.continuousMouse,
    });
    dialog.dispose();
  });

  it('writes positive distance and radius values and shows settings changed elsewhere', () => {
    const dialog = new DialogDisplacementPaintGeometry(document.body);
    const root = dialog.getRootElement();
    const state = getStateDisplacementSculpt();
    const distance = state.settingsRead().distance * 2;
    displacementUiFieldCommit(displacementUiFieldFind(root, 'Paint distance value'), String(distance));
    expect(state.settingsRead().distance).toBe(distance);
    const radius = state.settingsRead().radius * 3;
    const radiusRange = displacementUiFieldFind<HTMLInputElement>(root, 'Paint radius');
    displacementUiFieldCommit(radiusRange, String(radius));
    expect(state.settingsRead().radius).toBe(radius);
    const firstEffect = DISPLACEMENT_SCULPT_EFFECTS[0] ?? 'raise_lower';
    state.settingsWrite({ effect: paintGeometryTestLast(DISPLACEMENT_SCULPT_EFFECTS) });
    state.settingsWrite({ effect: firstEffect, radius: radius / 2 });
    expect(paintGeometryTestCheckedRead(root, 'Paint effect')).toBe(firstEffect);
    expect(Number(radiusRange.value)).toBe(radius / 2);
    dialog.dispose();
  });
});
