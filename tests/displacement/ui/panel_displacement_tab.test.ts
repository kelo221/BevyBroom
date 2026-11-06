import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { getStateDisplacementSculpt } from '@/displacement/state/state_displacement_sculpt.js';
import { PanelDisplacementTab } from '@/displacement/ui/panel_displacement_tab.js';
import { DISPLACEMENT_POWERS } from '@/displacement/model/displacement_types.js';
import { displacementVertexCount } from '@/displacement/model/displacement_face_surface.js';
import { getStateFaceEditSession } from '@/texture/paint/state_face_edit_session.js';
import { displacementTestOffsetsRead } from '../displacement_test_rig.js';
import {
  displacementUiButtonFind,
  displacementUiFieldCommit,
  displacementUiFieldFind,
  displacementUiTabCreate,
  displacementUiTopFaceAdd,
} from './panel_displacement_test_support.js';

/** Displacement tab of the Face Edit Sheet. */
describe('PanelDisplacementTab', () => {
  afterEach(() => {
    getStateDisplacementSculpt().reset();
    getStateFaceEditSession().reset();
    document.body.replaceChildren();
  });

  it('shows the Tools, Attributes and Masks groups and no whole-face Smooth button', () => {
    const { tab } = displacementUiTabCreate('TabGroups');
    const legends = [...tab.getElement().querySelectorAll('legend')].map((legend) => legend.textContent);
    expect(legends).toEqual(['Tools', 'Attributes', 'Masks']);
    expect([...tab.getElement().querySelectorAll('button')].some((button) => button.textContent === 'Smooth')).toBe(
      false,
    );
    tab.dispose();
  });

  it('creates a displacement with the Power spinner value and reports it', () => {
    const { tab, rig, selection, changeNotify, reports } = displacementUiTabCreate('TabCreate');
    const target = displacementUiTopFaceAdd(rig, new THREE.Vector3(0, 3, 0));
    selection.push(target);
    changeNotify();
    const largestPower = DISPLACEMENT_POWERS[DISPLACEMENT_POWERS.length - 1] ?? 4;
    displacementUiFieldCommit(displacementUiFieldFind(tab.getElement(), 'Power'), String(largestPower));
    expect(getStateDisplacementSculpt().settingsRead().power).toBe(largestPower);
    displacementUiButtonFind(tab.getElement(), 'Create').click();
    expect(displacementTestOffsetsRead(target)).toHaveLength(displacementVertexCount(largestPower));
    expect(reports).toEqual([tab.statusTextRead()]);
    displacementUiButtonFind(tab.getElement(), 'Destroy').click();
    expect(displacementTestOffsetsRead(target)).toEqual([]);
    tab.dispose();
  });

  it('opens the Noise window from the Noise tool', () => {
    const { tab, rig, selection, changeNotify } = displacementUiTabCreate('TabNoiseOpen');
    selection.push(displacementUiTopFaceAdd(rig, new THREE.Vector3(1, 0, -2)));
    changeNotify();
    displacementUiButtonFind(tab.getElement(), 'Create').click();
    expect(tab.noiseDialog.isOpen()).toBe(false);
    displacementUiButtonFind(tab.getElement(), 'Noise').click();
    expect(tab.noiseDialog.isOpen()).toBe(true);
    tab.dispose();
    expect(tab.noiseDialog.isOpen()).toBe(false);
  });

  it('disables the face actions and reports when no displacement tools are installed', () => {
    const tab = new PanelDisplacementTab({
      actionsRead: () => null,
      changeListenerAdd: () => () => undefined,
      floatingHost: document.body,
      statusReport: () => undefined,
      afterChange: () => undefined,
    });
    expect(displacementUiButtonFind(tab.getElement(), 'Create').disabled).toBe(true);
    expect(displacementUiButtonFind(tab.getElement(), 'Subdivide').disabled).toBe(true);
    expect(displacementUiButtonFind(tab.getElement(), 'Select').disabled).toBe(false);
    displacementUiButtonFind(tab.getElement(), 'Select Adjacent').click();
    expect(tab.statusTextRead()).toContain('not available');
    tab.dispose();
  });
});
