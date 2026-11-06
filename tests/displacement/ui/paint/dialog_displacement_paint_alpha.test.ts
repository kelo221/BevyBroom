import { afterEach, describe, expect, it } from 'vitest';
import { getStateDisplacementSculpt } from '@/displacement/state/state_displacement_sculpt.js';
import { DISPLACEMENT_ALPHA_MAX } from '@/displacement/model/displacement_types.js';
import { DialogDisplacementPaintAlpha } from '@/displacement/ui/paint/dialog_displacement_paint_alpha.js';
import { displacementUiFieldCommit, displacementUiFieldFind } from '../panel_displacement_test_support.js';

/** Displacement Paint Alpha window. */
describe('DialogDisplacementPaintAlpha', () => {
  afterEach(() => {
    getStateDisplacementSculpt().reset();
    document.body.replaceChildren();
  });

  it('writes the alpha value clamped to the alpha range, the radius, the edge and Spatial', () => {
    const dialog = new DialogDisplacementPaintAlpha(document.body);
    const root = dialog.getRootElement();
    const state = getStateDisplacementSculpt();
    const alphaValue = Math.round(DISPLACEMENT_ALPHA_MAX / 3);
    displacementUiFieldCommit(displacementUiFieldFind(root, 'Paint alpha'), String(alphaValue));
    expect(state.settingsRead().alphaValue).toBe(alphaValue);
    displacementUiFieldCommit(displacementUiFieldFind(root, 'Paint alpha value'), String(DISPLACEMENT_ALPHA_MAX * 2));
    expect(state.settingsRead().alphaValue).toBe(DISPLACEMENT_ALPHA_MAX);
    const radius = state.settingsRead().radius + 1;
    displacementUiFieldCommit(displacementUiFieldFind(root, 'Paint radius value'), String(radius));
    expect(state.settingsRead().radius).toBe(radius);
    displacementUiFieldFind<HTMLInputElement>(root, 'Hard-Edge').click();
    expect(state.settingsRead().edge).toBe('hard');
    const spatialBefore = state.settingsRead().spatial;
    displacementUiFieldFind<HTMLInputElement>(root, 'Spatial').click();
    expect(state.settingsRead().spatial).toBe(!spatialBefore);
    dialog.dispose();
  });

  it('shows alpha values set elsewhere and closes back to Select while Paint Alpha is active', () => {
    const dialog = new DialogDisplacementPaintAlpha(document.body);
    const state = getStateDisplacementSculpt();
    state.settingsWrite({ alphaValue: 0, activeTool: 'paint_alpha' });
    expect(Number(displacementUiFieldFind<HTMLInputElement>(dialog.getRootElement(), 'Paint alpha').value)).toBe(0);
    dialog.show();
    dialog.hide();
    expect(state.settingsRead().activeTool).toBe('select');
    state.settingsWrite({ activeTool: 'paint_geometry' });
    dialog.show();
    dialog.hide();
    expect(state.settingsRead().activeTool).toBe('paint_geometry');
    dialog.dispose();
  });
});
