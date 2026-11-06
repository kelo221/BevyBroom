import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { getStateDisplacementSculpt } from '@/displacement/state/state_displacement_sculpt.js';
import type { SolidFaceTextureTarget } from '@/texture/commands/command_texture_solid_face_edit.js';
import { getStateFaceEditSession } from '@/texture/paint/state_face_edit_session.js';
import { INPUT_NUMERIC_MIXED_VALUE_DISPLAY } from '@/ui/input/input_numeric_parse.js';
import { displacementTestCreate } from '../displacement_test_rig.js';
import {
  displacementUiButtonFind,
  displacementUiFieldCommit,
  displacementUiFieldFind,
  displacementUiTabCreate,
  displacementUiTopFaceAdd,
} from './panel_displacement_test_support.js';

/**
 * Reads the stored displacement of a face.
 *
 * @param target Brush face.
 * @returns Stored displacement, or undefined when flat.
 */
function attributesTestDisplacementRead(target: SolidFaceTextureTarget) {
  return target.model.findBrush(target.brushId)?.faceDisplacementRead(target.surfaceIndex);
}

/** Attributes group of the Displacement tab. */
describe('PanelDisplacementAttributesSection', () => {
  afterEach(() => {
    getStateDisplacementSculpt().reset();
    getStateFaceEditSession().reset();
    document.body.replaceChildren();
  });

  it('shows blank fields and the Create power while nothing is displaced', () => {
    const { tab, rig, selection, changeNotify } = displacementUiTabCreate('AttributesBlank');
    selection.push(displacementUiTopFaceAdd(rig, new THREE.Vector3(0, 0, 0)));
    changeNotify();
    const root = tab.getElement();
    expect(displacementUiFieldFind<HTMLInputElement>(root, 'Elevation').value).toBe('');
    expect(displacementUiFieldFind<HTMLInputElement>(root, 'Scale').value).toBe('');
    const power = getStateDisplacementSculpt().settingsRead().power;
    expect(Number(displacementUiFieldFind<HTMLInputElement>(root, 'Power').value)).toBe(power);
    expect(displacementUiFieldFind<HTMLInputElement>(root, 'Seals').checked).toBe(false);
    tab.dispose();
  });

  it('shows shared values, marks mixed ones and applies the edited fields as one undo step', () => {
    const { tab, rig, selection, changeNotify } = displacementUiTabCreate('AttributesApply');
    const first = displacementUiTopFaceAdd(rig, new THREE.Vector3(-2, 0, 0));
    const second = displacementUiTopFaceAdd(rig, new THREE.Vector3(3, 1, 4));
    displacementTestCreate(rig, first, 2);
    displacementTestCreate(rig, second, 3);
    selection.push(first, second);
    changeNotify();
    const root = tab.getElement();
    expect(displacementUiFieldFind<HTMLInputElement>(root, 'Power').value).toBe(INPUT_NUMERIC_MIXED_VALUE_DISPLAY);
    expect(Number(displacementUiFieldFind<HTMLInputElement>(root, 'Scale').value)).toBe(
      attributesTestDisplacementRead(first)?.scale,
    );
    const elevation = 0.75;
    displacementUiFieldCommit(displacementUiFieldFind(root, 'Elevation'), String(elevation));
    displacementUiFieldFind<HTMLInputElement>(root, 'Seals').click();
    const undoCountBefore = rig.commandStack.getUndoCount();
    displacementUiButtonFind(root, 'Apply').click();
    expect(rig.commandStack.getUndoCount()).toBe(undoCountBefore + 1);
    [first, second].forEach((target) => {
      expect(attributesTestDisplacementRead(target)?.elevation).toBe(elevation);
      expect(attributesTestDisplacementRead(target)?.flags.seals).toBe(true);
    });
    expect(attributesTestDisplacementRead(first)?.power).not.toBe(attributesTestDisplacementRead(second)?.power);
    expect(Number(displacementUiFieldFind<HTMLInputElement>(root, 'Elevation').value)).toBe(elevation);
    rig.commandStack.undo();
    [first, second].forEach((target) => expect(attributesTestDisplacementRead(target)?.flags.seals).toBe(false));
    tab.dispose();
  });

  it('shows a collision flag the faces disagree on as indeterminate and leaves it alone on Apply', () => {
    const { tab, rig, selection, changeNotify } = displacementUiTabCreate('AttributesMixedFlag');
    const first = displacementUiTopFaceAdd(rig, new THREE.Vector3(0, -2, 0));
    const second = displacementUiTopFaceAdd(rig, new THREE.Vector3(5, -2, 0));
    displacementTestCreate(rig, first, 2);
    displacementTestCreate(rig, second, 2);
    selection.push(first);
    changeNotify();
    displacementUiFieldFind<HTMLInputElement>(tab.getElement(), 'No Hull Collision').click();
    displacementUiButtonFind(tab.getElement(), 'Apply').click();
    selection.push(second);
    changeNotify();
    const hullCheckbox = displacementUiFieldFind<HTMLInputElement>(tab.getElement(), 'No Hull Collision');
    expect(hullCheckbox.indeterminate).toBe(true);
    displacementUiButtonFind(tab.getElement(), 'Apply').click();
    expect(attributesTestDisplacementRead(first)?.flags.noHullCollision).toBe(true);
    expect(attributesTestDisplacementRead(second)?.flags.noHullCollision).toBe(false);
    tab.dispose();
  });
});
