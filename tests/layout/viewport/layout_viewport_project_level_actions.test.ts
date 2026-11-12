import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  PROJECT_LEVEL_TEST_PROJECT_FILE,
  projectLevelActionsRigCreate,
  projectLevelRigProjectOpen,
  projectLevelTestPortalNamesRead,
  projectLevelTestSceneTextBuild,
} from '../../project/level/project_level_test_support.js';

/**
 * The layout's project level actions move scene content between the editor and
 * the open project's level documents.
 */
describe('LayoutViewportProjectLevelActions', () => {
  it('saves the open scene as a new level and writes later saves back into it', async () => {
    const rig = projectLevelActionsRigCreate();
    await projectLevelRigProjectOpen(rig);
    projectLevelTestSceneTextBuild(rig.context.sceneIOHandler, rig.context.worldObject, 'Gate');
    const created = await rig.actions.levelSaveAsNew('Castle Hall');
    expect(created.ok ? created.level.document : created.message).toBe('castle_hall.json');
    expect(rig.service.openLevelRead()?.document).toBe('castle_hall.json');
    rig.context.worldObject.add(new THREE.Group());
    const saved = await rig.actions.levelSave(false);
    expect(saved.ok).toBe(true);
    const documents = rig.control.projectLevelDocumentsRead(PROJECT_LEVEL_TEST_PROJECT_FILE);
    expect(documents.get('castle_hall.json')).toContain('Gate');
    expect(rig.service.listStateRead().levels.map((level) => level.document)).toEqual(['castle_hall.json']);
  });

  it('opens a level document into the editor and makes it the open level', async () => {
    const source = projectLevelActionsRigCreate();
    const text = projectLevelTestSceneTextBuild(
      source.context.sceneIOHandler,
      source.context.worldObject,
      'Drawbridge',
    );
    const rig = projectLevelActionsRigCreate();
    rig.control.projectLevelDocumentsRead(PROJECT_LEVEL_TEST_PROJECT_FILE).set('keep.json', text);
    await projectLevelRigProjectOpen(rig);
    const opened = await rig.actions.levelOpen('keep.json', false);
    expect(opened.ok ? opened.level.id : opened.message).toBe('keep');
    expect(projectLevelTestPortalNamesRead(rig.context.worldObject)).toEqual(['Drawbridge']);
    expect(rig.onSceneLoaded).toHaveBeenCalledTimes(1);
    expect(rig.service.openLevelRead()?.document).toBe('keep.json');
  });

  it('fails to open a missing level or a document that is not a scene', async () => {
    const rig = projectLevelActionsRigCreate();
    rig.control.projectLevelDocumentsRead(PROJECT_LEVEL_TEST_PROJECT_FILE).set('broken.json', '{"nope":1}');
    await projectLevelRigProjectOpen(rig);
    expect((await rig.actions.levelOpen('missing.json', false)).ok).toBe(false);
    expect((await rig.actions.levelOpen('broken.json', false)).ok).toBe(false);
    expect(rig.service.openLevelRead()).toBeNull();
  });

  it('refuses Save without an open level and reports a save refused on disk', async () => {
    const rig = projectLevelActionsRigCreate();
    await projectLevelRigProjectOpen(rig);
    expect((await rig.actions.levelSave(false)).ok).toBe(false);
    await rig.actions.levelSaveAsNew('hall');
    rig.control.projectLevelWrite = async () => ({ ok: false, message: 'changed', refusal: 'changed_on_disk' });
    const refused = await rig.actions.levelSave(false);
    expect(refused.ok ? '' : refused.refusal).toBe('changed_on_disk');
  });

  it('starts a new level from the startup scene, renames levels and reveals the browser', async () => {
    const rig = projectLevelActionsRigCreate();
    await projectLevelRigProjectOpen(rig);
    projectLevelTestSceneTextBuild(rig.context.sceneIOHandler, rig.context.worldObject, 'Old');
    expect((await rig.actions.levelNew('  ', false)).ok).toBe(false);
    const created = await rig.actions.levelNew('Fresh Pit', false);
    expect(created.ok ? created.level.document : created.message).toBe('fresh_pit.json');
    expect(projectLevelTestPortalNamesRead(rig.context.worldObject)).toEqual([]);
    const documents = rig.control.projectLevelDocumentsRead(PROJECT_LEVEL_TEST_PROJECT_FILE);
    expect(documents.get('fresh_pit.json')).not.toContain('Old');
    const renamed = await rig.actions.levelRename('fresh_pit.json', 'Deep Pit');
    expect(renamed.ok ? renamed.level.document : renamed.message).toBe('deep_pit.json');
    expect(rig.service.openLevelRead()?.document).toBe('deep_pit.json');
    rig.actions.levelBrowserReveal(true);
    expect(rig.levelBrowserReveal).toHaveBeenCalledWith(true);
  });
});
