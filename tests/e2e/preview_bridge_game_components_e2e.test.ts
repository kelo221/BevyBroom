import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import * as THREE from 'three';
import { EditorApi } from '@/ai/client/editor_api.js';
import type { McpToolResult } from '@/ai/shared/mcp_protocol_types.js';
import { GameEntityClassRegistry } from '@/game_entity/class/game_entity_class_registry.js';
import type { GameEntityClass } from '@/game_entity/class/game_entity_class_schema.js';
import { CommandGameEntityComponentsSet } from '@/game_entity/commands/command_game_entity_components_set.js';
import { GameEntityComponentStore } from '@/game_entity/component/game_entity_component_store.js';
import { GlbExporter } from '@/io/glb/glb_exporter.js';
import { documentIdentityEnsure } from '@/io/document/document_identity.js';
import { PreviewLinkTransportHttp } from '@/preview/link/preview_link_transport.js';
import { PREVIEW_METHOD, type PreviewBridgeStatus } from '@/preview/protocol/preview_protocol_types.js';
import { editorApiTestHostCreate, type EditorApiTestHostParts } from '../ai/client/editor_api_test_host.js';
import { PreviewE2eGameProcess, previewE2eProjectCopy, previewE2eProjectRemove } from './preview_e2e_game_process.js';
import { PreviewE2eRig, previewE2eSleep } from './preview_e2e_rig.js';
import { e2eWindowsShownRead, previewE2eEnvironmentRead } from './preview_e2e_environment.js';
import { previewE2eGameMaterialBoxCreate } from './preview_e2e_scene_parts.js';
import { previewE2eEntityRowsQuery } from './preview_e2e_game_query.js';
import {
  PREVIEW_E2E_AUTHORED_NODE_COMPONENT,
  PREVIEW_E2E_DOOR_COMPONENT,
  PREVIEW_E2E_DOOR_STATS_ASSET,
  PREVIEW_E2E_DOOR_STATS_MIRROR_COMPONENT,
  PREVIEW_E2E_GAME_ENTITY_COMPONENT,
  PREVIEW_E2E_PROPERTIES_COMPONENT,
  PREVIEW_E2E_SPINNER_COMPONENT,
  previewE2eObjectComponentRead,
  previewE2eOptionRead,
  previewE2ePropertiesRead,
} from './preview_e2e_game_components.js';

/**
 * End-to-end acceptance of game components: classes reported by the game, game
 * entities and components placed through the editor's MCP tools, data assets
 * written through the game, and shipped levels loaded without the editor.
 * Skipped unless BROOM_E2E_PREVIEW_EXE and BROOM_E2E_PROJECT_DIR are set; its
 * games listen three and four ports above BROOM_E2E_PORT.
 */
const environment = previewE2eEnvironmentRead(3);
const shippedEnvironment = previewE2eEnvironmentRead(4);
const STEP_TIMEOUT_MILLISECONDS = 60000;
const PAD_SIZE = new THREE.Vector3(2, 0.5, 2);
const SHIPPED_SCENE_PATH = 'shipped/components_level.glb';
const UNKNOWN_CLASS = 'other_game::placeables::Lever';

/** Value kinds whose defaults the game's serialized door shows directly. */
const DOOR_SCALAR_KINDS = new Set(['number', 'integer', 'bool', 'text', 'enum']);

/**
 * Returns the data of a successful tool result.
 *
 * @param result Tool result.
 * @returns The result data.
 */
function toolData<Data>(result: McpToolResult): Data {
  if (!result.ok) {
    throw new Error(`tool failed: ${result.message}`);
  }
  return result.data as Data;
}

/**
 * Returns whether a serialized field equals an editor value, comparing numbers
 * at single precision.
 *
 * @param actual Value the game reports.
 * @param expected Value the editor holds.
 * @returns True when they match.
 */
function fieldMatches(actual: unknown, expected: unknown): boolean {
  if (typeof actual === 'number' && typeof expected === 'number') {
    return Math.abs(actual - expected) < 1e-4;
  }
  return JSON.stringify(actual) === JSON.stringify(expected);
}

/**
 * Returns whether two records hold the same keys with matching values, in any
 * key order.
 *
 * @param actual Record the game reports.
 * @param expected Record the editor holds.
 * @returns True when they match.
 */
function recordsMatch(actual: Record<string, unknown>, expected: Record<string, unknown>): boolean {
  const expectedEntries = Object.entries(expected);
  const hasSameKeyCount = Object.keys(actual).length === expectedEntries.length;
  return hasSameKeyCount && expectedEntries.every(([key, value]) => fieldMatches(actual[key], value));
}

describe.skipIf(!environment.isConfigured)('game components in the game preview end to end', () => {
  let projectDirectory = '';
  let game: PreviewE2eGameProcess;
  let parts: EditorApiTestHostParts;
  let api: EditorApi;
  let rig: PreviewE2eRig;
  let pad: THREE.Mesh;
  let doorEntityId = '';

  beforeAll(() => {
    projectDirectory = previewE2eProjectCopy(environment.sourceProjectDirectory);
    game = new PreviewE2eGameProcess(
      environment.previewExecutable,
      projectDirectory,
      environment.bridgePort,
      e2eWindowsShownRead(),
    );
    game.start();
    parts = editorApiTestHostCreate();
    api = new EditorApi(parts.host);
    pad = previewE2eGameMaterialBoxCreate(
      'Pad',
      'stone/castle_wall',
      new THREE.Vector3(0, PAD_SIZE.y / 2, 0),
      PAD_SIZE,
    );
    parts.world.add(pad);
    documentIdentityEnsure(parts.world);
    rig = new PreviewE2eRig(parts.world, environment.endpoint, 'components_level');
  });

  afterAll(async () => {
    rig?.controller.disconnect();
    await game?.stop();
    if (projectDirectory !== '') {
      previewE2eProjectRemove(projectDirectory);
    }
  });

  /**
   * Keeps the editor link updating until a check on the game passes.
   *
   * @param description What is waited for.
   * @param check Reads the game and returns a value when satisfied, else null.
   * @returns The value the check returned.
   */
  async function gameUntil<Value>(description: string, check: () => Promise<Value | null>): Promise<Value> {
    const end = performance.now() + STEP_TIMEOUT_MILLISECONDS;
    while (performance.now() < end) {
      await rig.run(250);
      const value = await check().catch(() => null);
      if (value !== null) {
        return value;
      }
    }
    throw new Error(`Timed out waiting for ${description}; link error: ${rig.controller.lastErrorRead()}`);
  }

  /**
   * Waits until the game's door on the door entity satisfies a condition.
   *
   * @param description What is waited for.
   * @param condition Condition on the serialized door.
   * @returns The serialized door.
   */
  function gameDoorUntil(
    description: string,
    condition: (door: Record<string, unknown>) => boolean,
  ): Promise<Record<string, unknown>> {
    return gameUntil(description, async () => {
      const door = await previewE2eObjectComponentRead(
        rig.transport,
        PREVIEW_E2E_GAME_ENTITY_COMPONENT,
        doorEntityId,
        PREVIEW_E2E_DOOR_COMPONENT,
      );
      return door && condition(door) ? door : null;
    });
  }

  /**
   * Reads the spinner on the pad's game entity.
   *
   * @returns The serialized spinner, or null.
   */
  function padSpinnerRead(): Promise<Record<string, unknown> | null> {
    return previewE2eObjectComponentRead(
      rig.transport,
      PREVIEW_E2E_AUTHORED_NODE_COMPONENT,
      pad.uuid,
      PREVIEW_E2E_SPINNER_COMPONENT,
    );
  }

  /**
   * Returns the door class the game reported.
   *
   * @returns Door class.
   */
  function doorClass(): GameEntityClass {
    const gameClass = GameEntityClassRegistry.classFind(PREVIEW_E2E_DOOR_COMPONENT);
    if (!gameClass) {
      throw new Error('the game reported the door class');
    }
    return gameClass;
  }

  /**
   * Returns the default of a top-level door field.
   *
   * @param path Field path.
   * @returns Default value.
   */
  function doorDefault(path: string): unknown {
    return doorClass().fields.find((field) => field.path === path)?.default;
  }

  /**
   * Waits until the game's status satisfies a condition.
   *
   * @param description What is waited for.
   * @param condition Condition on the status.
   * @returns The status.
   */
  function gameStatusUntil(
    description: string,
    condition: (status: PreviewBridgeStatus) => boolean,
  ): Promise<PreviewBridgeStatus> {
    return gameUntil(description, async () => {
      const status = await rig.transport.call<PreviewBridgeStatus>(PREVIEW_METHOD.status, {}, 5000);
      return condition(status) ? status : null;
    });
  }

  it(
    'reports the game classes, and a placed door starts at the defaults the game reported',
    async () => {
      await rig.until(
        'the game classes',
        (view) => rig.isCaughtUp(view) && GameEntityClassRegistry.classFind(PREVIEW_E2E_DOOR_COMPONENT) !== null,
        STEP_TIMEOUT_MILLISECONDS,
      );
      const classes = toolData<{ classes: { type_path: string }[] }>(api.invokeTool('list_game_classes')).classes;
      const typePaths = classes.map((gameClass) => gameClass.type_path);
      expect(typePaths).toEqual(
        expect.arrayContaining([
          PREVIEW_E2E_DOOR_COMPONENT,
          PREVIEW_E2E_SPINNER_COMPONENT,
          PREVIEW_E2E_PROPERTIES_COMPONENT,
        ]),
      );
      doorEntityId = toolData<{ id: string }>(
        api.invokeTool('add_game_entity', { class: PREVIEW_E2E_DOOR_COMPONENT, position: { x: 3, y: 0, z: 0 } }),
      ).id;
      const scalarFields = doorClass().fields.filter((field) => DOOR_SCALAR_KINDS.has(field.kind));
      expect(scalarFields.length).toBeGreaterThan(0);
      await gameDoorUntil('a door at its defaults', (door) =>
        scalarFields.every((field) => fieldMatches(door[field.path], field.default)),
      );
    },
    STEP_TIMEOUT_MILLISECONDS * 2,
  );

  it(
    'applies field overrides and keeps the defaults of the other fields',
    async () => {
      const speed = Number(doorDefault('speed')) + 2;
      toolData(
        api.invokeTool('set_game_components', {
          id: doorEntityId,
          components: { [PREVIEW_E2E_DOOR_COMPONENT]: { speed, key_name: 'silver' } },
        }),
      );
      const door = await gameDoorUntil('the overridden door', (next) => fieldMatches(next['speed'], speed));
      expect(door['key_name']).toBe('silver');
      expect(fieldMatches(door['uses'], doorDefault('uses'))).toBe(true);
    },
    STEP_TIMEOUT_MILLISECONDS,
  );

  it(
    'follows an edit and its undo',
    async () => {
      const overriddenSpeed = Number(doorDefault('speed')) + 2;
      const editedSpeed = overriddenSpeed + 1;
      toolData(
        api.invokeTool('set_game_components', {
          id: doorEntityId,
          components: { [PREVIEW_E2E_DOOR_COMPONENT]: { speed: editedSpeed } },
        }),
      );
      await gameDoorUntil('the edited speed', (door) => fieldMatches(door['speed'], editedSpeed));
      expect(parts.commandStack.undo()).toBe(true);
      await gameDoorUntil('the speed before the edit', (door) => fieldMatches(door['speed'], overriddenSpeed));
    },
    STEP_TIMEOUT_MILLISECONDS * 2,
  );

  it(
    'puts a spinner on a brush and keeps it when the geometry is published again',
    async () => {
      toolData(
        api.invokeTool('set_game_components', {
          id: pad.uuid,
          components: { [PREVIEW_E2E_SPINNER_COMPONENT]: { speed: 2.5 } },
        }),
      );
      await gameUntil('the spinner on the pad', async () => {
        const spinner = await padSpinnerRead();
        return spinner && fieldMatches(spinner['speed'], 2.5) ? spinner : null;
      });
      const geometryRevisionBefore = rig.controller.revisionsRead().geometry;
      pad.geometry = new THREE.BoxGeometry(PAD_SIZE.x * 1.5, PAD_SIZE.y, PAD_SIZE.z);
      await rig.until(
        'the republished pad',
        (view) => rig.isCaughtUp(view) && view.status.geometry_revision_applied > geometryRevisionBefore,
        STEP_TIMEOUT_MILLISECONDS,
      );
      await gameUntil('the spinner on the new pad', async () => ((await padSpinnerRead()) ? true : null));
    },
    STEP_TIMEOUT_MILLISECONDS * 3,
  );

  it(
    'removes a component from the game',
    async () => {
      toolData(
        api.invokeTool('set_game_components', { id: pad.uuid, components: { [PREVIEW_E2E_SPINNER_COMPONENT]: null } }),
      );
      await gameUntil('the spinner to be gone', async () => ((await padSpinnerRead()) === null ? true : null));
    },
    STEP_TIMEOUT_MILLISECONDS,
  );

  it(
    'places free-form properties of every value type',
    async () => {
      const values = { team: 'red', lives: 3, boss: true };
      toolData(
        api.invokeTool('set_game_components', {
          id: doorEntityId,
          components: { [PREVIEW_E2E_PROPERTIES_COMPONENT]: { values } },
        }),
      );
      await gameUntil('the properties', async () => {
        const properties = await previewE2eObjectComponentRead(
          rig.transport,
          PREVIEW_E2E_GAME_ENTITY_COMPONENT,
          doorEntityId,
          PREVIEW_E2E_PROPERTIES_COMPONENT,
        );
        return recordsMatch(previewE2ePropertiesRead(properties), values) ? true : null;
      });
    },
    STEP_TIMEOUT_MILLISECONDS,
  );

  /**
   * Waits until the door's stats mirror shows a file and health.
   *
   * @param path Expected stats file.
   * @param health Expected health.
   */
  function doorStatsMirrorUntil(path: string, health: number): Promise<boolean> {
    return gameUntil(`the door stats ${path} with health ${health}`, async () => {
      const mirror = await previewE2eObjectComponentRead(
        rig.transport,
        PREVIEW_E2E_GAME_ENTITY_COMPONENT,
        doorEntityId,
        PREVIEW_E2E_DOOR_STATS_MIRROR_COMPONENT,
      );
      const isShown =
        previewE2eOptionRead(mirror?.['path']) === path &&
        fieldMatches(previewE2eOptionRead(mirror?.['health']), health);
      return isShown ? true : null;
    });
  }

  /**
   * Returns the first door stats file and its health, read through the game.
   *
   * @returns Asset path and health.
   */
  async function doorStatsFirstRead(): Promise<{ path: string; health: number }> {
    const assetType = GameEntityClassRegistry.assetTypeFind(PREVIEW_E2E_DOOR_STATS_ASSET);
    const path = assetType?.paths[0];
    if (!assetType?.editable || !path) {
      throw new Error('the game reported editable door stats files');
    }
    const read = toolData<{ values: Record<string, unknown> }>(await api.invokeToolAsync('read_data_asset', { path }));
    const healthDefault = assetType.fields?.find((field) => field.path === 'health')?.default;
    return { path, health: Number(read.values['health'] ?? healthDefault) };
  }

  it(
    'references a data asset file whose values the game loads',
    async () => {
      const stats = await doorStatsFirstRead();
      toolData(
        api.invokeTool('set_game_components', {
          id: doorEntityId,
          components: { [PREVIEW_E2E_DOOR_COMPONENT]: { stats: stats.path } },
        }),
      );
      await doorStatsMirrorUntil(stats.path, stats.health);
    },
    STEP_TIMEOUT_MILLISECONDS,
  );

  it(
    'writes a data asset file that the game reloads',
    async () => {
      const stats = await doorStatsFirstRead();
      const health = stats.health + 111;
      const written = toolData<{ generation: number }>(
        await api.invokeToolAsync('write_data_asset', { path: stats.path, values: { health } }),
      );
      await gameStatusUntil('the data asset write', (status) => status.data_asset_generation >= written.generation);
      expect(readFileSync(join(projectDirectory, 'assets', stats.path), 'utf8')).toContain(String(health));
      await doorStatsMirrorUntil(stats.path, health);
    },
    STEP_TIMEOUT_MILLISECONDS,
  );

  it(
    'ships the components in an exported GLB and in the level manifest',
    async () => {
      const shippedFile = join(projectDirectory, 'assets', SHIPPED_SCENE_PATH);
      mkdirSync(dirname(shippedFile), { recursive: true });
      writeFileSync(shippedFile, new Uint8Array(await new GlbExporter().exportForFile(parts.world)));
      const shippedProject = previewE2eProjectCopy(projectDirectory);
      const shippedGame = new PreviewE2eGameProcess(
        shippedEnvironment.previewExecutable,
        shippedProject,
        shippedEnvironment.bridgePort,
        e2eWindowsShownRead(),
        ['--scene', SHIPPED_SCENE_PATH, '--level', rig.levelName],
      );
      shippedGame.start();
      try {
        await shippedDoorsWait(new PreviewLinkTransportHttp(shippedEnvironment.endpoint));
      } finally {
        await shippedGame.stop();
        previewE2eProjectRemove(shippedProject);
      }
    },
    STEP_TIMEOUT_MILLISECONDS * 2,
  );

  /**
   * Waits until the shipped game shows the door twice: once on the game entity
   * the manifest spawned and once on the node of the exported GLB, both with
   * the overridden key name.
   *
   * @param transport Transport to the shipped game.
   */
  async function shippedDoorsWait(transport: PreviewLinkTransportHttp): Promise<void> {
    const end = performance.now() + STEP_TIMEOUT_MILLISECONDS;
    while (performance.now() < end) {
      const rows = await previewE2eEntityRowsQuery(
        transport,
        [PREVIEW_E2E_DOOR_COMPONENT],
        [PREVIEW_E2E_GAME_ENTITY_COMPONENT],
      ).catch(() => []);
      const silver = rows.filter(
        (row) => (row.components[PREVIEW_E2E_DOOR_COMPONENT] as { key_name?: string }).key_name === 'silver',
      );
      const fromManifest = silver.filter((row) => row.has?.[PREVIEW_E2E_GAME_ENTITY_COMPONENT] === true);
      if (fromManifest.length === 1 && silver.length === 2) {
        return;
      }
      await previewE2eSleep(250);
    }
    throw new Error('Timed out waiting for the shipped doors');
  }

  it(
    'reports a component class the game does not have and still applies the others',
    async () => {
      const command = new CommandGameEntityComponentsSet([pad], () => ({
        [UNKNOWN_CLASS]: { pull: 1 },
        [PREVIEW_E2E_SPINNER_COMPONENT]: { speed: 1.25 },
      }));
      parts.commandStack.push(command);
      expect(Object.keys(GameEntityComponentStore.read(pad))).toContain(UNKNOWN_CLASS);
      await gameStatusUntil('the unknown class error', (status) =>
        status.errors.some((error) => error.message.includes(UNKNOWN_CLASS)),
      );
      await gameUntil('the spinner next to the unknown class', async () => {
        const spinner = await padSpinnerRead();
        return spinner && fieldMatches(spinner['speed'], 1.25) ? true : null;
      });
    },
    STEP_TIMEOUT_MILLISECONDS,
  );
});
