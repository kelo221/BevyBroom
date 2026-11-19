import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GameEntityModelLibrary } from '@/game_entity/model/game_entity_model_library.js';
import { GameEntityModelProjectFollower } from '@/game_entity/model/game_entity_model_project_follower.js';
import { workbenchRigCreate } from '../../project/workbench/project_workbench_rig.js';
import { gameEntityModelTestBase64, gameEntityModelTestGlbCreate } from './game_entity_model_test_files.js';

/** Path of the model the tests serve. */
const MODEL_PATH = 'assets/Models/Props/Crate/Crate.glb';

/**
 * Builds a workbench rig serving one model, with a private library followed by
 * the project follower.
 *
 * @returns Rig parts.
 */
async function followerRigCreate() {
  const rig = workbenchRigCreate();
  rig.control.projectModelFiles.set(
    MODEL_PATH,
    gameEntityModelTestBase64(await gameEntityModelTestGlbCreate(new THREE.Vector3(1, 1, 1))),
  );
  const library = new GameEntityModelLibrary();
  const statusMessages: string[] = [];
  const follower = new GameEntityModelProjectFollower({
    workbench: rig.workbench,
    control: rig.control,
    statusReport: (message) => statusMessages.push(message),
    library,
  });
  return { ...rig, library, statusMessages, follower };
}

/**
 * The model follower lets the library read models only from the open project
 * and makes it forget them whenever a project is opened again or closed.
 */
describe('GameEntityModelProjectFollower', () => {
  it('reads no model before a project is open', async () => {
    const rig = await followerRigCreate();
    expect(rig.library.templateRead(MODEL_PATH)).toBeNull();
    await rig.library.idle();
    expect(rig.control.projectModelReads).toEqual([]);
  });

  it('reads models through the control once a project is open', async () => {
    const rig = await followerRigCreate();
    await rig.workbench.projectOpen('/games/store/broom.project.json');
    await rig.follower.idle();
    rig.library.templateRead(MODEL_PATH);
    await rig.library.idle();
    expect(rig.library.templateRead(MODEL_PATH)).not.toBeNull();
    expect(rig.control.projectModelReads).toEqual([MODEL_PATH]);
  });

  it('forgets loaded models and reports failures of the project opened next', async () => {
    const rig = await followerRigCreate();
    await rig.workbench.projectOpen('/games/store/broom.project.json');
    await rig.follower.idle();
    rig.library.templateRead(MODEL_PATH);
    await rig.library.idle();
    const epochBefore = rig.library.readerEpoch();
    rig.control.projectModelFiles.clear();
    await rig.workbench.projectOpen('/games/lobby/broom.project.json');
    await rig.follower.idle();
    expect(rig.library.readerEpoch()).not.toBe(epochBefore);
    expect(rig.library.templateRead(MODEL_PATH)).toBeNull();
    await rig.library.idle();
    expect(rig.statusMessages.some((message) => message.includes(MODEL_PATH))).toBe(true);
  });
});
