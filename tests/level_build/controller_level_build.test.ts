import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ControllerLevelBuild } from '@/level_build/controller_level_build.js';
import { MATERIAL_IDENTITY_EXPORT_EXTRAS_KEY } from '@/materials/identity/material_identity.js';
import { IssueProviderRegistry } from '@/info_panel/issues/issue_provider_registry.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { SolidModel } from '@/solid/model/solid_model.js';
import { SolidOperation } from '@/solid/types/solid_operation.js';
import { base64ToBytes } from '@/utils/utils_base64.js';
import { GameProcessControlFake } from '../project/workbench/project_workbench_rig.js';
import { levelBuildTestGlbFromDocument } from './level_build_test_glb.js';

/** Material id the stub exporter puts into the geometry. */
const LEVEL_BUILD_TEST_MATERIAL_ID = 'walls/stone';

/** Controller, world, control and the geometry the stub exporter returns. */
interface LevelBuildRig {
  controller: ControllerLevelBuild;
  world: THREE.Group;
  control: GameProcessControlFake;
  glb: Uint8Array;
}

/**
 * Builds a controller over a world with one solid model and a fake control.
 *
 * @returns Test rig without an open project.
 */
function rigCreate(): LevelBuildRig {
  const world = new THREE.Group();
  const model = new SolidModel('LevelBuildModel');
  model.addBoxBrush(2, SolidOperation.Additive);
  world.add(model.root);
  const control = new GameProcessControlFake();
  const glb = levelBuildTestGlbFromDocument({
    asset: { version: '2.0' },
    materials: [{ extras: { [MATERIAL_IDENTITY_EXPORT_EXTRAS_KEY]: LEVEL_BUILD_TEST_MATERIAL_ID } }],
  });
  const controller = new ControllerLevelBuild({
    worldGroup: world,
    gameProcessControlRead: () => control,
    levelNameRead: () => 'scene_level',
    glbExport: async () => glb.slice().buffer,
    issuesCollect: (worldGroup) => IssueProviderRegistry.issuesCollect(worldGroup),
  });
  return { controller, world, control, glb };
}

/**
 * Opens a project in the fake control.
 *
 * @param rig Test rig.
 */
async function projectOpen(rig: LevelBuildRig): Promise<void> {
  await rig.control.projectOpen('/games/hall/broom.project.json');
}

/** Unit tests for Build Level. */
describe('ControllerLevelBuild', () => {
  it('refuses to build without an open project', async () => {
    const rig = rigCreate();
    const result = await rig.controller.build();
    expect(result.ok).toBe(false);
    expect(rig.control.publishedLevels).toHaveLength(0);
  });

  it('publishes the exported geometry with a manifest of the world', async () => {
    const rig = rigCreate();
    await projectOpen(rig);
    const result = await rig.controller.build('Great Hall');
    expect(result.ok, result.ok ? '' : result.message).toBe(true);
    const [request] = rig.control.publishedLevels;
    if (!request) {
      throw new Error('nothing was published');
    }
    expect(request.levelName).toBe('great_hall');
    expect(base64ToBytes(request.glbBase64)).toEqual(rig.glb);
    expect(request.manifest.materials).toEqual([LEVEL_BUILD_TEST_MATERIAL_ID]);
    expect(request.manifest.state.objects.some((object) => object.kind === 'solid')).toBe(true);
    expect(request.manifest.state.project_id).toBe((await rig.control.statusRead()).project?.projectIdentifier);
  });

  it('uses the scene-derived level name when none is given', async () => {
    const rig = rigCreate();
    await projectOpen(rig);
    await rig.controller.build();
    expect(rig.control.publishedLevels[0]?.levelName).toBe('scene_level');
  });

  it('stops at error issues and publishes nothing', async () => {
    const rig = rigCreate();
    await projectOpen(rig);
    const brushMesh = SolidModel.fromObject(rig.world.children[0] ?? rig.world)?.getBrushes()[0]?.mesh;
    if (!brushMesh) {
      throw new Error('rig has no brush mesh');
    }
    GameEntityComponentStore.write(brushMesh, { 'game::Door': {} });
    const result = await rig.controller.build();
    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.problems.map((problem) => problem.objectUuid)).toContain(brushMesh.uuid);
    expect(rig.control.publishedLevels).toHaveLength(0);
  });

  it('reports the failure the publisher returns', async () => {
    const rig = rigCreate();
    await projectOpen(rig);
    rig.control.nextPublishResult = { ok: false, message: 'disk full' };
    const result = await rig.controller.build();
    expect(result.ok ? '' : result.message).toBe('disk full');
  });
});
