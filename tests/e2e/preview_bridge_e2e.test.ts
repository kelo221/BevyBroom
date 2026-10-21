import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { copyFileSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { LightOwner } from '@/light/model/light_owner.js';
import { CommandEntityDuplicate } from '@/entity/commands/command_entity_duplicate.js';
import { CommandEntitySettingsSet } from '@/entity/commands/command_entity_settings_set.js';
import { CommandObjectHierarchyDelete } from '@/outliner/commands/command_object_hierarchy_delete.js';
import { SceneSerializer } from '@/io/scene/scene_serializer.js';
import { SceneDeserializer } from '@/io/scene/scene_deserializer.js';
import { documentIdentityEnsure } from '@/io/document/document_identity.js';
import {
  PREVIEW_METHOD,
  PREVIEW_PROTOCOL_VERSION,
  type PreviewBridgeStatus,
} from '@/preview/protocol/preview_protocol_types.js';
import { PreviewE2eGameProcess, previewE2eProjectCopy, previewE2eProjectRemove } from './preview_e2e_game_process.js';
import { PreviewE2eRig, type PreviewE2eGameView } from './preview_e2e_rig.js';
import { e2eWindowsShownRead, previewE2eEnvironmentRead } from './preview_e2e_environment.js';
import { previewE2eGameMaterialBoxCreate } from './preview_e2e_scene_parts.js';

/**
 * End-to-end acceptance of the live game preview: the editor's real preview
 * link drives the real native preview program. Skipped unless
 * BROOM_E2E_PREVIEW_EXE names the built broom_preview executable and
 * BROOM_E2E_PROJECT_DIR names a project directory (broom.project.json and
 * assets/); the project is copied to a temporary directory first.
 */
const environment = previewE2eEnvironmentRead(0);
const endpoint = environment.endpoint;
const STEP_TIMEOUT_MILLISECONDS = 60000;
const BAKE_TIMEOUT_MILLISECONDS = 240000;

/** Editor objects of the acceptance scene. */
interface AcceptanceScene {
  world: THREE.Group;
  rooms: THREE.Group;
  wallRoom: THREE.Mesh;
  floorRoom: THREE.Mesh;
  pointLight: THREE.Group;
  spotLight: THREE.Group;
}

/**
 * Creates a six by three by six meter room box with a game material.
 *
 * @param name Object name.
 * @param materialIdentifier Game material id.
 * @param position Room center.
 * @returns Content mesh.
 */
function roomCreate(name: string, materialIdentifier: string, position: THREE.Vector3): THREE.Mesh {
  return previewE2eGameMaterialBoxCreate(name, materialIdentifier, position, new THREE.Vector3(6, 3, 6));
}

/**
 * Builds two rooms with game materials inside a group, a point light in that
 * group and a spot light at the top level pointing down.
 *
 * @returns The scene.
 */
function acceptanceSceneCreate(): AcceptanceScene {
  const world = new THREE.Group();
  const rooms = new THREE.Group();
  rooms.name = 'Rooms';
  const wallRoom = roomCreate('Wall room', 'stone/castle_wall', new THREE.Vector3(0, 1.5, 0));
  const floorRoom = roomCreate('Floor room', 'wood/floor_planks', new THREE.Vector3(8, 1.5, 0));
  const pointLight = LightOwner.createDefault('Point light', 'point');
  pointLight.position.set(0, 2, 0);
  const spotLight = LightOwner.createDefault('Spot light', 'spot');
  spotLight.position.set(8, 2.8, 0);
  spotLight.rotation.x = -Math.PI / 2;
  rooms.add(wallRoom, floorRoom, pointLight);
  world.add(rooms, spotLight);
  return { world, rooms, wallRoom, floorRoom, pointLight, spotLight };
}

/**
 * Reads the game material catalog file of the project copy.
 *
 * @param projectDirectory Project copy.
 * @returns Path and parsed catalog.
 */
function catalogFileRead(projectDirectory: string): {
  path: string;
  catalog: { materials: Array<Record<string, unknown>> };
} {
  const path = join(projectDirectory, 'assets', 'broom', 'materials.json');
  return { path, catalog: JSON.parse(readFileSync(path, 'utf8')) };
}

describe.skipIf(!environment.isConfigured)('game preview end to end', () => {
  let projectDirectory = '';
  let game: PreviewE2eGameProcess;
  let scene: AcceptanceScene;
  let rig: PreviewE2eRig;
  let lights: THREE.Group[] = [];
  let documentIdentifier = '';

  beforeAll(() => {
    projectDirectory = previewE2eProjectCopy(environment.sourceProjectDirectory);
    game = new PreviewE2eGameProcess(
      environment.previewExecutable,
      projectDirectory,
      environment.bridgePort,
      e2eWindowsShownRead(),
    );
    game.start();
    scene = acceptanceSceneCreate();
    documentIdentifier = documentIdentityEnsure(scene.world);
    lights = [scene.pointLight, scene.spotLight];
    rig = new PreviewE2eRig(scene.world, endpoint, 'acceptance_level');
  });

  afterAll(async () => {
    rig?.controller.disconnect();
    await game?.stop();
    if (projectDirectory !== '') {
      previewE2eProjectRemove(projectDirectory);
    }
  });

  /**
   * Waits until the game shows the newest revisions and exactly the expected
   * lights.
   *
   * @param description What is waited for.
   * @returns The matching game view.
   */
  function gameMatchesEditor(description: string): Promise<PreviewE2eGameView> {
    return rig.until(
      description,
      (view) => rig.isCaughtUp(view) && rig.isShowingLights(view, lights),
      STEP_TIMEOUT_MILLISECONDS,
    );
  }

  it(
    'shows two rooms with their game materials, a point light and a spot light',
    async () => {
      const view = await gameMatchesEditor('the initial scene');
      expect(view.status.document_id).toBe(documentIdentifier);
      expect(view.status.light_count).toBe(lights.length);
      expect(view.status.geometry_file).not.toBeNull();
      expect(rig.loadedCatalogs.length).toBeGreaterThan(0);
      const catalogIdentifiers =
        rig.loadedCatalogs[rig.loadedCatalogs.length - 1]?.entries.map((entry) => entry.id) ?? [];
      expect(catalogIdentifiers).toEqual(expect.arrayContaining(['stone/castle_wall', 'wood/floor_planks']));
    },
    BAKE_TIMEOUT_MILLISECONDS,
  );

  it(
    'follows a light drag and a light settings edit',
    async () => {
      for (let step = 1; step <= 10; step++) {
        scene.pointLight.position.x = step * 0.2;
        await rig.run(50);
      }
      new CommandEntitySettingsSet(LightOwner, [scene.spotLight], (settings) => ({
        ...settings,
        intensity: settings.intensity * 2,
      })).execute();
      await gameMatchesEditor('the dragged light');
    },
    STEP_TIMEOUT_MILLISECONDS,
  );

  it(
    'duplicates, deletes, undoes and redoes lights without stray entities',
    async () => {
      const duplicate = new CommandEntityDuplicate([scene.spotLight]);
      duplicate.execute();
      const clone = duplicate.getClonedOwners()[0];
      expect(clone).toBeDefined();
      if (!clone) return;
      clone.position.z += 2;
      lights = [scene.pointLight, scene.spotLight, clone];
      await gameMatchesEditor('the duplicated light');
      duplicate.undo();
      lights = [scene.pointLight, scene.spotLight];
      await gameMatchesEditor('the undone duplicate');
      duplicate.execute();
      lights = [scene.pointLight, scene.spotLight, clone];
      await gameMatchesEditor('the redone duplicate');
      const deletion = new CommandObjectHierarchyDelete([scene.pointLight]);
      deletion.execute();
      lights = [scene.spotLight, clone];
      await gameMatchesEditor('the deleted light');
      deletion.undo();
      lights = [scene.pointLight, scene.spotLight, clone];
      await gameMatchesEditor('the restored light');
    },
    BAKE_TIMEOUT_MILLISECONDS,
  );

  it(
    'moves lights inside a parent group with the group',
    async () => {
      const geometryRevisionBefore = rig.controller.revisionsRead().geometry;
      scene.rooms.position.x += 3;
      await gameMatchesEditor('the moved parent group');
      expect(rig.controller.revisionsRead().geometry).toBe(geometryRevisionBefore);
    },
    STEP_TIMEOUT_MILLISECONDS,
  );

  it(
    'swaps in edited geometry as a new revision',
    async () => {
      const view = await rig.gameViewRead();
      const previousFile = view.status.geometry_file;
      const previousRevision = view.status.geometry_revision_applied;
      scene.floorRoom.geometry = new THREE.BoxGeometry(8, 3, 6);
      const swapped = await rig.until(
        'the edited geometry',
        (next) => rig.isCaughtUp(next) && next.status.geometry_revision_applied > previousRevision,
        STEP_TIMEOUT_MILLISECONDS,
      );
      expect(swapped.status.geometry_file).not.toBe(previousFile);
      expect(rig.isShowingLights(swapped, lights)).toBe(true);
    },
    STEP_TIMEOUT_MILLISECONDS,
  );

  it(
    'keeps the shown state when the game receives an invalid snapshot or a broken geometry file',
    async () => {
      const before = await rig.gameViewRead();
      const invalidObjects = [0, 1].map(() => ({
        id: 'same-id',
        parent_id: null,
        name: 'duplicate',
        kind: 'group',
        visible: true,
        translation: [0, 0, 0],
        rotation: [0, 0, 0, 1],
        scale: [1, 1, 1],
        light: null,
      }));
      const invalidState = {
        protocol: PREVIEW_PROTOCOL_VERSION,
        project_id: before.status.project_id,
        document_id: documentIdentifier,
        session_id: 'e2e-invalid',
        revision: 1_000_000,
        geometry_revision: 0,
        objects: invalidObjects,
      };
      await expect(rig.transport.call(PREVIEW_METHOD.applyState, invalidState, 5000)).rejects.toThrow();
      const brokenGeometry = {
        protocol: PREVIEW_PROTOCOL_VERSION,
        document_id: documentIdentifier,
        session_id: 'e2e-invalid',
        geometry_revision: 1_000_000,
        level_name: 'acceptance_level',
        glb_base64: btoa('not a binary gltf file'),
      };
      await expect(rig.transport.call(PREVIEW_METHOD.publishGeometry, brokenGeometry, 5000)).rejects.toThrow();
      const after = await gameMatchesEditor('the scene after invalid input');
      expect(after.status.state_revision_applied).toBe(before.status.state_revision_applied);
      expect(after.status.geometry_file).toBe(before.status.geometry_file);
    },
    STEP_TIMEOUT_MILLISECONDS,
  );

  it(
    'reopens a saved scene in a new editor session without duplicating anything',
    async () => {
      const savedJson = JSON.stringify(new SceneSerializer().serialize(scene.world));
      rig.controller.disconnect();
      const reopenedWorld = new THREE.Group();
      new SceneDeserializer().deserialize(JSON.parse(savedJson), reopenedWorld);
      expect(documentIdentityEnsure(reopenedWorld)).toBe(documentIdentifier);
      lights = lights.map((light) => reopenedWorld.getObjectByProperty('uuid', light.uuid) as THREE.Group);
      expect(lights.every((light) => light !== undefined)).toBe(true);
      rig = new PreviewE2eRig(reopenedWorld, endpoint, 'acceptance_level');
      const view = await gameMatchesEditor('the reopened scene');
      expect(view.status.document_id).toBe(documentIdentifier);
    },
    STEP_TIMEOUT_MILLISECONDS,
  );

  it(
    'restores everything after the game restarts, without duplicates',
    async () => {
      const before = await rig.gameViewRead();
      await game.stop();
      game.start();
      const view = await rig.until(
        'the restarted game',
        (next) =>
          next.status.instance_id !== before.status.instance_id &&
          rig.isCaughtUp(next) &&
          rig.isShowingLights(next, lights),
        STEP_TIMEOUT_MILLISECONDS,
      );
      expect(view.status.light_count).toBe(lights.length);
    },
    STEP_TIMEOUT_MILLISECONDS,
  );

  it(
    'reloads a game material changed twice and a replaced texture in place',
    async () => {
      for (const color of [
        [0.9, 0.2, 0.2, 1],
        [0.2, 0.9, 0.2, 1],
      ]) {
        const loadedBefore = rig.loadedCatalogs.length;
        const { path, catalog } = catalogFileRead(projectDirectory);
        const wall = catalog.materials.find((material) => material['id'] === 'stone/castle_wall');
        if (wall) wall['base_color'] = color;
        writeFileSync(path, JSON.stringify(catalog, null, 2));
        await rig.until(
          'the reloaded catalog',
          () => rig.loadedCatalogs.length > loadedBefore,
          STEP_TIMEOUT_MILLISECONDS,
        );
        const reply = await rig.transport.call<{ catalog: { materials: Array<Record<string, unknown>> } }>(
          PREVIEW_METHOD.catalog,
          {},
          5000,
        );
        const gameColor = reply.catalog.materials.find((material) => material['id'] === 'stone/castle_wall')?.[
          'base_color'
        ] as number[] | undefined;
        color.forEach((channel, index) => expect(gameColor?.[index]).toBeCloseTo(channel, 5));
      }
      const texturesDirectory = join(projectDirectory, 'assets', 'textures');
      const replacementSize = statSync(join(texturesDirectory, 'floor_planks_base.png')).size;
      const loadedBefore = rig.loadedCatalogs.length;
      copyFileSync(join(texturesDirectory, 'floor_planks_base.png'), join(texturesDirectory, 'castle_wall_base.png'));
      await rig.until(
        'the replaced texture',
        () => rig.loadedCatalogs.length > loadedBefore,
        STEP_TIMEOUT_MILLISECONDS,
      );
      const wallEntry = rig.loadedCatalogs[rig.loadedCatalogs.length - 1]?.entries.find(
        (entry) => entry.id === 'stone/castle_wall',
      );
      expect(wallEntry?.byteSize).toBe(replacementSize);
      await gameMatchesEditor('the scene after material reloads');
    },
    BAKE_TIMEOUT_MILLISECONDS,
  );

  it(
    'bakes, marks the bake stale after a light move and never applies a stale bake',
    async () => {
      const bakedSpotLight = lights.find((light) => LightOwner.settingsRead(light)?.kind === 'spot');
      expect(bakedSpotLight).toBeDefined();
      if (!bakedSpotLight) return;
      const isBakeState = (state: PreviewBridgeStatus['bake_state']) => (view: PreviewE2eGameView) =>
        rig.isCaughtUp(view) && view.status.bake_state === state;
      await rig.controller.previewBakeRequest();
      await rig.until('a current bake', isBakeState('current'), BAKE_TIMEOUT_MILLISECONDS);
      bakedSpotLight.position.y -= 0.3;
      await rig.until('a stale bake', isBakeState('needs_bake'), STEP_TIMEOUT_MILLISECONDS);
      await rig.controller.previewBakeRequest();
      for (let step = 0; step < 30; step++) {
        bakedSpotLight.position.x += 0.02;
        await rig.run(100);
      }
      const settled = await rig.until(
        'the bake after moving during it',
        (view) => rig.isCaughtUp(view) && view.status.bake_state !== 'baking',
        BAKE_TIMEOUT_MILLISECONDS,
      );
      expect(settled.status.bake_state).toBe('needs_bake');
      expect(game.logRead()).toContain('result dropped');
    },
    BAKE_TIMEOUT_MILLISECONDS * 2,
  );
});
