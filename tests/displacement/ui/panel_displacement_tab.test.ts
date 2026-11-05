import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { getStateDisplacementSculpt } from '@/displacement/state/state_displacement_sculpt.js';
import { ControllerDisplacementActions } from '@/displacement/controller/controller_displacement_actions.js';
import { PanelDisplacementTab } from '@/displacement/ui/panel_displacement_tab.js';
import { displacementVertexCount } from '@/displacement/model/displacement_face_surface.js';
import { getStateFaceEditSession } from '@/texture/paint/state_face_edit_session.js';
import {
  displacementTestBoxAdd,
  displacementTestCreate,
  displacementTestFaceFacing,
  displacementTestOffsetsRead,
  displacementTestRigCreate,
  displacementTestTarget,
} from '../displacement_test_rig.js';

/**
 * Finds a button of the tab by its text.
 *
 * @param tab Displacement tab.
 * @param text Button text.
 * @returns Button element.
 */
function tabTestButtonFind(tab: PanelDisplacementTab, text: string): HTMLButtonElement {
  const button = [...tab.getElement().querySelectorAll('button')].find((entry) => entry.textContent === text);
  if (!button) throw new Error(`button ${text} missing`);
  return button;
}

/**
 * Finds a field of the tab by its accessible name.
 *
 * @param tab Displacement tab.
 * @param label Accessible name.
 * @returns Field element.
 */
function tabTestFieldFind<T extends HTMLElement>(tab: PanelDisplacementTab, label: string): T {
  const field = tab.getElement().querySelector<T>(`[aria-label="${label}"]`);
  if (!field) throw new Error(`field ${label} missing`);
  return field;
}

/** Displacement tab of the Face Edit Sheet. */
describe('PanelDisplacementTab', () => {
  afterEach(() => {
    getStateDisplacementSculpt().reset();
    getStateFaceEditSession().reset();
  });

  it('creates a displacement of the chosen power on the selected face and reports it', () => {
    const rig = displacementTestRigCreate('TabTest');
    const brush = displacementTestBoxAdd(rig, new THREE.Vector3(2, 2, 2), new THREE.Vector3(0, 3, 0));
    const target = displacementTestTarget(rig, brush, displacementTestFaceFacing(brush, new THREE.Vector3(0, 0, -1)));
    const reports: string[] = [];
    let changeCount = 0;
    const tab = new PanelDisplacementTab({
      actionsRead: () => new ControllerDisplacementActions(rig.commandStack, () => [target]),
      statusReport: (message) => reports.push(message),
      afterChange: () => {
        changeCount += 1;
      },
    });
    const powerSelect = tabTestFieldFind<HTMLSelectElement>(tab, 'Displacement power');
    powerSelect.value = '4';
    powerSelect.dispatchEvent(new Event('change'));
    tabTestButtonFind(tab, 'Create').click();
    expect(displacementTestOffsetsRead(target)).toHaveLength(displacementVertexCount(4));
    expect(changeCount).toBe(1);
    expect(reports).toEqual([tab.statusTextRead()]);
    tabTestButtonFind(tab, 'Destroy').click();
    expect(displacementTestOffsetsRead(target)).toEqual([]);
    tab.dispose();
  });

  it('applies reproducible noise from the session seed shown in the Seed field, one undo step per pass', () => {
    const rig = displacementTestRigCreate('TabNoiseSeed');
    const brush = displacementTestBoxAdd(rig, new THREE.Vector3(3, 1, 3), new THREE.Vector3(2, 0, -1));
    const target = displacementTestTarget(rig, brush, displacementTestFaceFacing(brush, new THREE.Vector3(0, 1, 0)));
    displacementTestCreate(rig, target, 3);
    getStateDisplacementSculpt().settingsWrite({ noiseMin: -0.5, noiseMax: 0.5 });
    const tab = new PanelDisplacementTab({
      actionsRead: () => new ControllerDisplacementActions(rig.commandStack, () => [target]),
      statusReport: () => undefined,
      afterChange: () => undefined,
    });
    const seedField = tabTestFieldFind<HTMLInputElement>(tab, 'Noise seed');
    seedField.value = '42';
    seedField.dispatchEvent(new Event('change'));
    expect(getStateFaceEditSession().displacementNoiseSeedRead()).toBe(42);
    const undoCountBefore = rig.commandStack.getUndoCount();
    tabTestButtonFind(tab, 'Apply Noise').click();
    expect(rig.commandStack.getUndoCount()).toBe(undoCountBefore + 1);
    const firstPass = displacementTestOffsetsRead(target);
    rig.commandStack.undo();
    tabTestButtonFind(tab, 'Apply Noise').click();
    expect(displacementTestOffsetsRead(target)).toEqual(firstPass);
    rig.commandStack.undo();
    getStateFaceEditSession().displacementNoiseSeedWrite(43);
    expect(seedField.value).toBe('43');
    tabTestButtonFind(tab, 'Apply Noise').click();
    expect(displacementTestOffsetsRead(target)).not.toEqual(firstPass);
    tab.dispose();
  });

  it('reports when no displacement tools are installed', () => {
    const tab = new PanelDisplacementTab({
      actionsRead: () => null,
      statusReport: () => undefined,
      afterChange: () => undefined,
    });
    tabTestButtonFind(tab, 'Subdivide').click();
    expect(tab.statusTextRead()).toContain('not available');
    tab.dispose();
  });

  it('writes Paint Geometry settings and shows settings changed elsewhere', () => {
    const tab = new PanelDisplacementTab({
      actionsRead: () => null,
      statusReport: () => undefined,
      afterChange: () => undefined,
    });
    tabTestFieldFind<HTMLInputElement>(tab, 'Paint Geometry').click();
    expect(getStateDisplacementSculpt().settingsRead().paintEnabled).toBe(true);
    const radiusField = tabTestFieldFind<HTMLInputElement>(tab, 'Paint radius');
    radiusField.value = '2.5';
    radiusField.dispatchEvent(new Event('change'));
    expect(getStateDisplacementSculpt().settingsRead().radius).toBe(2.5);
    radiusField.value = '-1';
    radiusField.dispatchEvent(new Event('change'));
    expect(getStateDisplacementSculpt().settingsRead().radius).toBe(2.5);
    getStateDisplacementSculpt().settingsWrite({ tool: 'smooth' });
    expect(tabTestFieldFind<HTMLSelectElement>(tab, 'Paint tool').value).toBe('smooth');
    tab.dispose();
  });
});
