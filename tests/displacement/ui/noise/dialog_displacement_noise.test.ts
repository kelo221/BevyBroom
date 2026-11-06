import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { getStateDisplacementSculpt } from '@/displacement/state/state_displacement_sculpt.js';
import { ControllerDisplacementActions } from '@/displacement/controller/controller_displacement_actions.js';
import { DialogDisplacementNoise } from '@/displacement/ui/noise/dialog_displacement_noise.js';
import { getStateFaceEditSession } from '@/texture/paint/state_face_edit_session.js';
import {
  displacementTestCreate,
  displacementTestOffsetsRead,
  displacementTestRigCreate,
} from '../../displacement_test_rig.js';
import {
  displacementUiButtonFind,
  displacementUiFieldCommit,
  displacementUiFieldFind,
  displacementUiTopFaceAdd,
} from '../panel_displacement_test_support.js';

/** Noise window of the Displacement tab. */
describe('DialogDisplacementNoise', () => {
  afterEach(() => {
    getStateDisplacementSculpt().reset();
    getStateFaceEditSession().reset();
    document.body.replaceChildren();
  });

  it('stores the typed range and seed and applies reproducible noise, one undo step per pass', () => {
    const rig = displacementTestRigCreate('NoiseDialog');
    const target = displacementUiTopFaceAdd(rig, new THREE.Vector3(2, 0, -1));
    displacementTestCreate(rig, target, 3);
    const actions = new ControllerDisplacementActions(rig.commandStack, () => [target]);
    const dialog = new DialogDisplacementNoise(document.body, (action) => action(actions));
    dialog.show();
    const root = dialog.getRootElement();
    displacementUiFieldCommit(displacementUiFieldFind(root, 'Noise min'), '-0.5');
    displacementUiFieldCommit(displacementUiFieldFind(root, 'Noise max'), '0.5');
    displacementUiFieldCommit(displacementUiFieldFind(root, 'Noise seed'), '42');
    expect(getStateDisplacementSculpt().settingsRead()).toMatchObject({ noiseMin: -0.5, noiseMax: 0.5 });
    expect(getStateFaceEditSession().displacementNoiseSeedRead()).toBe(42);
    const undoCountBefore = rig.commandStack.getUndoCount();
    displacementUiButtonFind(root, 'Apply').click();
    expect(rig.commandStack.getUndoCount()).toBe(undoCountBefore + 1);
    const firstPass = displacementTestOffsetsRead(target);
    expect(firstPass.some((offset) => offset !== 0)).toBe(true);
    rig.commandStack.undo();
    displacementUiButtonFind(root, 'Apply').click();
    expect(displacementTestOffsetsRead(target)).toEqual(firstPass);
    rig.commandStack.undo();
    getStateFaceEditSession().displacementNoiseSeedWrite(43);
    expect(displacementUiFieldFind<HTMLInputElement>(root, 'Noise seed').value).toBe('43');
    displacementUiButtonFind(root, 'Apply').click();
    expect(displacementTestOffsetsRead(target)).not.toEqual(firstPass);
    dialog.dispose();
  });

  it('keeps the stored range when a typed bound is invalid', () => {
    const dialog = new DialogDisplacementNoise(document.body, () => undefined);
    const before = getStateDisplacementSculpt().settingsRead().noiseMin;
    displacementUiFieldCommit(displacementUiFieldFind(dialog.getRootElement(), 'Noise min'), 'not a number');
    expect(getStateDisplacementSculpt().settingsRead().noiseMin).toBe(before);
    expect(Number(displacementUiFieldFind<HTMLInputElement>(dialog.getRootElement(), 'Noise min').value)).toBe(before);
    dialog.dispose();
  });
});
