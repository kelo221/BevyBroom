import { afterEach, describe, expect, it } from 'vitest';
import { getStateDisplacementSculpt } from '@/displacement/state/state_displacement_sculpt.js';
import { getStateFaceEditSession } from '@/texture/paint/state_face_edit_session.js';
import { displacementUiFieldFind, displacementUiTabCreate } from './panel_displacement_test_support.js';

/** Masks group of the Displacement tab. */
describe('PanelDisplacementMasksSection', () => {
  afterEach(() => {
    getStateDisplacementSculpt().reset();
    getStateFaceEditSession().reset();
    document.body.replaceChildren();
  });

  it('writes the Grid mask and the Select mask into the session and shows session changes', () => {
    const { tab } = displacementUiTabCreate('MasksToggle');
    const session = getStateFaceEditSession();
    const gridCheckbox = displacementUiFieldFind<HTMLInputElement>(tab.getElement(), 'Grid mask');
    const selectCheckbox = displacementUiFieldFind<HTMLInputElement>(tab.getElement(), 'Select mask');
    expect(gridCheckbox.checked).toBe(session.gridMaskRead());
    expect(selectCheckbox.checked).toBe(!session.hideMaskRead());
    const gridBefore = session.gridMaskRead();
    gridCheckbox.click();
    expect(session.gridMaskRead()).toBe(!gridBefore);
    const hiddenBefore = session.hideMaskRead();
    selectCheckbox.click();
    expect(session.hideMaskRead()).toBe(!hiddenBefore);
    session.hideMaskWrite(!session.hideMaskRead());
    expect(selectCheckbox.checked).toBe(!session.hideMaskRead());
    session.gridMaskWrite(!session.gridMaskRead());
    expect(gridCheckbox.checked).toBe(session.gridMaskRead());
    tab.dispose();
  });
});
