import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import * as THREE from 'three';
import { LightOwner } from '@/light/model/light_owner.js';
import { PortalOwner } from '@/portal/model/portal_owner.js';
import { RoomOwner } from '@/portal/model/room_owner.js';
import { CommandEntitySettingsSet } from '@/entity/commands/command_entity_settings_set.js';
import { GlbExporter } from '@/io/glb/glb_exporter.js';
import { PreviewLinkTransportHttp } from '@/preview/link/preview_link_transport.js';
import { SceneSerializer } from '@/io/scene/scene_serializer.js';
import { SceneDeserializer } from '@/io/scene/scene_deserializer.js';
import { documentIdentityEnsure, documentIdentityReset } from '@/io/document/document_identity.js';
import type { PreviewBridgeStatus } from '@/preview/protocol/preview_protocol_types.js';
import { PreviewE2eGameProcess, previewE2eProjectCopy, previewE2eProjectRemove } from './preview_e2e_game_process.js';
import { PreviewE2eRig, previewE2eSleep, type PreviewE2eGameView } from './preview_e2e_rig.js';
import { e2eWindowsShownRead, previewE2eEnvironmentRead } from './preview_e2e_environment.js';
import { previewE2eGameMaterialBoxCreate } from './preview_e2e_scene_parts.js';
import {
  PREVIEW_E2E_DYNAMIC_LIGHT_COMPONENT,
  PREVIEW_E2E_PORTAL_COMPONENT,
  PREVIEW_E2E_ROOM_COMPONENT,
  previewE2eEntityRowsQuery,
  previewE2eOnlyPortalClosedIs,
  previewE2eOnlyPortalOpenByGameplay,
} from './preview_e2e_game_query.js';

/**
 * End-to-end acceptance of rooms, portals and level bookkeeping in the live
 * game preview. Skipped unless BROOM_E2E_PREVIEW_EXE and BROOM_E2E_PROJECT_DIR
 * are set; its game listens one port above BROOM_E2E_PORT so it can run next to
 * the other preview end-to-end test.
 */
const environment = previewE2eEnvironmentRead(1);
const shippedEnvironment = previewE2eEnvironmentRead(12);
const SHIPPED_SCENE_PATH = 'shipped/portal_level.glb';
const STEP_TIMEOUT_MILLISECONDS = 60000;
const BAKE_TIMEOUT_MILLISECONDS = 240000;
const ROOM_HALF_SIZE = new THREE.Vector3(3, 1.5, 3);

/** Editor objects of the two-room scene. */
interface PortalScene {
  world: THREE.Group;
  hallB: THREE.Mesh;
  rooms: THREE.Group[];
  portal: THREE.Group;
  light: THREE.Group;
}

/**
 * Creates a hall box and the room cell that covers it.
 *
 * @param world World root the hall and room are added to.
 * @param name Hall name.
 * @param center Hall center.
 * @returns The hall mesh and its room.
 */
function hallWithRoomAdd(world: THREE.Group, name: string, center: THREE.Vector3): [THREE.Mesh, THREE.Group] {
  const hall = previewE2eGameMaterialBoxCreate(
    name,
    'stone/castle_wall',
    center,
    ROOM_HALF_SIZE.clone().multiplyScalar(2),
  );
  const room = RoomOwner.create(`${name} room`, {
    halfSizeX: ROOM_HALF_SIZE.x,
    halfSizeY: ROOM_HALF_SIZE.y,
    halfSizeZ: ROOM_HALF_SIZE.z,
  });
  room.position.copy(center);
  world.add(hall, room);
  return [hall, room];
}

/**
 * Builds two halls side by side along X with a room each, a doorway portal in
 * the wall they share facing +X, and a light in the first hall.
 *
 * @returns The scene.
 */
function portalSceneCreate(): PortalScene {
  const world = new THREE.Group();
  const roomA = hallWithRoomAdd(world, 'Hall A', new THREE.Vector3(0, ROOM_HALF_SIZE.y, 0))[1];
  const [hallB, roomB] = hallWithRoomAdd(world, 'Hall B', new THREE.Vector3(ROOM_HALF_SIZE.x * 2, ROOM_HALF_SIZE.y, 0));
  const portalSettings = PortalOwner.definition.settingsCreateDefault();
  const portal = PortalOwner.create('Doorway', portalSettings);
  portal.position.set(ROOM_HALF_SIZE.x, portalSettings.height / 2, 0);
  portal.rotation.y = Math.PI / 2;
  const light = LightOwner.createDefault('Hall light', 'point');
  light.position.set(0, ROOM_HALF_SIZE.y, 0);
  world.add(portal, light);
  return { world, hallB, rooms: [roomA, roomB], portal, light };
}

/**
 * Returns whether a game view shows two rooms and one portal with culling on.
 *
 * @param status Game status.
 * @returns True when portal culling is active for the scene.
 */
function isCullingTwoRoomsAndOnePortal(status: PreviewBridgeStatus): boolean {
  return status.room_count === 2 && status.portal_count === 1 && status.portal_state === 'active';
}

/**
 * Lists the geometry and manifest files the bridge left in a level directory.
 *
 * @param levelDirectory Level directory.
 * @returns Bridge file names, empty when the directory is gone.
 */
function levelBridgeFilesList(levelDirectory: string): string[] {
  if (!existsSync(levelDirectory)) {
    return [];
  }
  return readdirSync(levelDirectory).filter((name) => /^geometry_.*\.glb$/.test(name) || name === 'level.broom.json');
}

/**
 * Rooms, portals and lights a game shows, counted through the Bevy remote
 * protocol.
 */
interface ShippedCellCounts {
  rooms: number;
  portals: number;
  lightRadii: number[];
}

/**
 * Counts the rooms and portals of a game and reads the radius of every light.
 *
 * @param transport Transport to the game's bridge.
 * @returns The counts, or null while the game does not answer yet.
 */
async function shippedCellCountsRead(transport: PreviewLinkTransportHttp): Promise<ShippedCellCounts | null> {
  try {
    const rooms = await previewE2eEntityRowsQuery(transport, [PREVIEW_E2E_ROOM_COMPONENT]);
    const portals = await previewE2eEntityRowsQuery(transport, [PREVIEW_E2E_PORTAL_COMPONENT]);
    const lights = await previewE2eEntityRowsQuery(transport, [PREVIEW_E2E_DYNAMIC_LIGHT_COMPONENT]);
    const lightRadii = lights.map((row) =>
      Number((row.components[PREVIEW_E2E_DYNAMIC_LIGHT_COMPONENT] as { radius?: number }).radius),
    );
    return { rooms: rooms.length, portals: portals.length, lightRadii };
  } catch {
    return null;
  }
}

/**
 * Waits until a game shows the expected rooms, portals and light radii.
 *
 * @param transport Transport to the game's bridge.
 * @param expected The counts and radii to wait for.
 * @param timeoutMilliseconds How long to wait.
 * @returns The last counts read.
 */
async function shippedCellCountsUntil(
  transport: PreviewLinkTransportHttp,
  expected: ShippedCellCounts,
  timeoutMilliseconds: number,
): Promise<ShippedCellCounts | null> {
  const end = performance.now() + timeoutMilliseconds;
  let counts: ShippedCellCounts | null = null;
  while (performance.now() < end) {
    counts = await shippedCellCountsRead(transport);
    if (counts !== null && JSON.stringify(counts) === JSON.stringify(expected)) {
      return counts;
    }
    await previewE2eSleep(250);
  }
  return counts;
}

describe.skipIf(!environment.isConfigured)('game preview rooms and portals end to end', () => {
  let projectDirectory = '';
  let game: PreviewE2eGameProcess;
  let scene: PortalScene;
  let rig: PreviewE2eRig;

  beforeAll(() => {
    projectDirectory = previewE2eProjectCopy(environment.sourceProjectDirectory);
    game = new PreviewE2eGameProcess(
      environment.previewExecutable,
      projectDirectory,
      environment.bridgePort,
      e2eWindowsShownRead(),
    );
    game.start();
    scene = portalSceneCreate();
    documentIdentityEnsure(scene.world);
    rig = new PreviewE2eRig(scene.world, environment.endpoint, 'portal_level');
  });

  afterAll(async () => {
    rig?.controller.disconnect();
    await game?.stop();
    if (projectDirectory !== '') {
      previewE2eProjectRemove(projectDirectory);
    }
  });

  /**
   * Waits until the game shows the newest revisions, the light and culling over
   * both rooms.
   *
   * @param description What is waited for.
   * @returns The matching game view.
   */
  function gameMatchesEditor(description: string): Promise<PreviewE2eGameView> {
    return rig.until(
      description,
      (view) =>
        rig.isCaughtUp(view) && rig.isShowingLights(view, [scene.light]) && isCullingTwoRoomsAndOnePortal(view.status),
      STEP_TIMEOUT_MILLISECONDS,
    );
  }

  /**
   * Keeps the link updating until the game's only portal is closed or open.
   *
   * @param isClosed Whether the portal must carry the closed component.
   */
  async function gamePortalClosedUntil(isClosed: boolean): Promise<void> {
    const end = performance.now() + STEP_TIMEOUT_MILLISECONDS;
    while (performance.now() < end) {
      await rig.run(250);
      if (await previewE2eOnlyPortalClosedIs(rig.transport, isClosed)) {
        return;
      }
    }
    throw new Error(`Timed out waiting for the portal to be ${isClosed ? 'closed' : 'open'}`);
  }

  /**
   * Sets whether the doorway portal is closed through the editor's undoable
   * settings command.
   *
   * @param closed New closed flag.
   */
  function portalClosedWrite(closed: boolean): void {
    new CommandEntitySettingsSet(PortalOwner, [scene.portal], (settings) => ({ ...settings, closed })).execute();
  }

  it(
    'joins two rooms through a portal and turns portal culling on',
    async () => {
      const view = await gameMatchesEditor('portal culling over two rooms');
      expect(view.status.portal_message).toBeNull();
      expect(view.status.bake_state).toBe('no_bake');
      expect(await previewE2eEntityRowsQuery(rig.transport, [PREVIEW_E2E_ROOM_COMPONENT])).toHaveLength(
        scene.rooms.length,
      );
      expect(await previewE2eEntityRowsQuery(rig.transport, [PREVIEW_E2E_PORTAL_COMPONENT])).toHaveLength(1);
    },
    BAKE_TIMEOUT_MILLISECONDS,
  );

  it(
    'closes, opens and moves the doorway live without republishing geometry',
    async () => {
      const geometryRevisionBefore = rig.controller.revisionsRead().geometry;
      portalClosedWrite(true);
      await gamePortalClosedUntil(true);
      portalClosedWrite(false);
      await gamePortalClosedUntil(false);
      scene.portal.position.z += 0.5;
      await gameMatchesEditor('the moved doorway');
      expect(rig.controller.revisionsRead().geometry).toBe(geometryRevisionBefore);
    },
    STEP_TIMEOUT_MILLISECONDS * 3,
  );

  it(
    'keeps a door opened by gameplay open while other objects are edited, until the door is edited',
    async () => {
      portalClosedWrite(true);
      await gamePortalClosedUntil(true);
      await previewE2eOnlyPortalOpenByGameplay(rig.transport);
      scene.light.position.y += 0.25;
      await gameMatchesEditor('the moved light next to the door gameplay opened');
      expect(await previewE2eOnlyPortalClosedIs(rig.transport, false)).toBe(true);
      scene.portal.position.z -= 0.25;
      await gamePortalClosedUntil(true);
      portalClosedWrite(false);
      await gamePortalClosedUntil(false);
    },
    STEP_TIMEOUT_MILLISECONDS * 4,
  );

  it(
    'publishes the geometry once more when the game fails to load it',
    async () => {
      const geometryRevisionBefore = rig.controller.revisionsRead().geometry;
      rig.unloadableGeometryPublicationsRemaining = 1;
      scene.hallB.geometry = new THREE.BoxGeometry(ROOM_HALF_SIZE.x * 2, ROOM_HALF_SIZE.y * 2, ROOM_HALF_SIZE.z * 1.5);
      const view = await rig.until(
        'the republished geometry',
        (next) =>
          rig.isCaughtUp(next) &&
          next.status.geometry_revision_failed > geometryRevisionBefore &&
          next.status.geometry_revision_applied > next.status.geometry_revision_failed,
        STEP_TIMEOUT_MILLISECONDS,
      );
      expect(view.status.geometry_revision_failed).toBe(geometryRevisionBefore + 1);
      expect(rig.unloadableGeometryPublicationsRemaining).toBe(0);
    },
    STEP_TIMEOUT_MILLISECONDS,
  );

  it(
    'removes the old level files when the level is renamed',
    async () => {
      const levelsDirectory = join(projectDirectory, 'assets', 'broom', 'levels');
      const oldLevelDirectory = join(levelsDirectory, rig.levelName);
      expect(levelBridgeFilesList(oldLevelDirectory)).not.toEqual([]);
      const geometryRevisionBefore = rig.controller.revisionsRead().geometry;
      rig.levelName = `${rig.levelName}_renamed`;
      const view = await rig.until(
        'the renamed level',
        (next) => rig.isCaughtUp(next) && next.status.geometry_revision_applied > geometryRevisionBefore,
        STEP_TIMEOUT_MILLISECONDS,
      );
      expect(isCullingTwoRoomsAndOnePortal(view.status)).toBe(true);
      expect(levelBridgeFilesList(join(levelsDirectory, rig.levelName))).not.toEqual([]);
      expect(levelBridgeFilesList(oldLevelDirectory)).toEqual([]);
    },
    STEP_TIMEOUT_MILLISECONDS,
  );

  it(
    'reports that a bake is needed when the first bake went stale',
    async () => {
      await rig.controller.previewBakeRequest();
      for (let step = 0; step < 30; step++) {
        scene.light.position.x += 0.02;
        await rig.run(100);
      }
      const settled = await rig.until(
        'the first bake after moving during it',
        (view) => rig.isCaughtUp(view) && view.status.bake_state !== 'baking',
        BAKE_TIMEOUT_MILLISECONDS,
      );
      expect(settled.status.bake_state).toBe('needs_bake');
    },
    BAKE_TIMEOUT_MILLISECONDS * 2,
  );

  it(
    'bakes level meshes that all carry a second UV set',
    async () => {
      await rig.controller.previewBakeRequest();
      await rig.until(
        'a current bake',
        (view) => rig.isCaughtUp(view) && view.status.bake_state === 'current',
        BAKE_TIMEOUT_MILLISECONDS,
      );
      await previewE2eSleep(500);
      expect(game.logRead()).not.toContain('has no UV1');
    },
    BAKE_TIMEOUT_MILLISECONDS,
  );

  it(
    'ships lights, rooms and portals in an exported GLB that a game shows without the editor',
    async () => {
      const shippedProject = previewE2eProjectCopy(environment.sourceProjectDirectory);
      const shippedFile = join(shippedProject, 'assets', SHIPPED_SCENE_PATH);
      mkdirSync(dirname(shippedFile), { recursive: true });
      writeFileSync(shippedFile, new Uint8Array(await new GlbExporter().exportForFile(scene.world)));
      const shippedGame = new PreviewE2eGameProcess(
        shippedEnvironment.previewExecutable,
        shippedProject,
        shippedEnvironment.bridgePort,
        e2eWindowsShownRead(),
        ['--scene', SHIPPED_SCENE_PATH],
      );
      const radius = LightOwner.settingsRead(scene.light)?.radius ?? Number.NaN;
      const expected = { rooms: scene.rooms.length, portals: 1, lightRadii: [radius] };
      shippedGame.start();
      try {
        const transport = new PreviewLinkTransportHttp(shippedEnvironment.endpoint);
        expect(await shippedCellCountsUntil(transport, expected, STEP_TIMEOUT_MILLISECONDS)).toEqual(expected);
      } finally {
        await shippedGame.stop();
        previewE2eProjectRemove(shippedProject);
      }
    },
    STEP_TIMEOUT_MILLISECONDS * 2,
  );

  it(
    'starts a new document on Save As while the game keeps one copy of everything',
    async () => {
      const firstDocument = documentIdentityEnsure(scene.world);
      const savedJson = JSON.stringify(new SceneSerializer().serialize(scene.world));
      rig.controller.disconnect();
      const copiedWorld = new THREE.Group();
      new SceneDeserializer().deserialize(JSON.parse(savedJson), copiedWorld);
      documentIdentityReset(copiedWorld);
      const copiedDocument = documentIdentityEnsure(copiedWorld);
      const copiedLight = copiedWorld.getObjectByProperty('uuid', scene.light.uuid);
      expect(copiedLight).toBeDefined();
      if (!(copiedLight instanceof THREE.Group)) return;
      scene = { ...scene, world: copiedWorld, light: copiedLight };
      rig = new PreviewE2eRig(copiedWorld, environment.endpoint, 'portal_level_copy');
      const view = await rig.until(
        'the document saved under a new name',
        (next) => next.status.document_id === copiedDocument && rig.isCaughtUp(next),
        STEP_TIMEOUT_MILLISECONDS,
      );
      expect(copiedDocument).not.toBe(firstDocument);
      expect(rig.isShowingLights(view, [copiedLight])).toBe(true);
      expect(isCullingTwoRoomsAndOnePortal(view.status)).toBe(true);
    },
    STEP_TIMEOUT_MILLISECONDS,
  );
});
